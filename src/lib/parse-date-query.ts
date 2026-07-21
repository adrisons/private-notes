/**
 * Turn a date expression typed into search ("agosto 2025", "5 marzo 2026",
 * "el mes pasado") into a concrete range, so the ranker can score a note's
 * creation date by proximity to it (ADR-011).
 *
 * Why parse rather than embed: an embedding model has no numeric ordering, so
 * `agosto 2025` and `agosto 2024` land in nearly the same place in vector
 * space and `5 marzo` vs `6 marzo` are indistinguishable. Dates are already
 * structured metadata; the useful move is to read them out of the query and
 * score them exactly.
 *
 * No dependency: `date-fns` is forbidden without an ADR (AGENTS §3), and this
 * is hand-written arithmetic over the platform `Date` and `Intl`.
 */

export type DateGranularity = "year" | "month" | "day";

export interface DateQuery {
  /** Inclusive start of the range, in local time. */
  from: Date;
  /** Exclusive end of the range, in local time. */
  to: Date;
  /** How precise the query was — scales the proximity decay outside the range. */
  granularity: DateGranularity;
  /** The exact substring of the original query that was read as a date. */
  matchedText: string;
}

export interface ParseDateOptions {
  /**
   * Locale whose month names and numeric field order are used. Defaults to the
   * runtime locale; English month names are always accepted as a fallback so
   * `March`/`Mar` work whatever the active locale is.
   */
  locale?: string;
  /** Reference point for relative expressions and bare months. Defaults to now. */
  now?: Date;
}

const DAY_MS = 86_400_000;

/** Half-life of the proximity decay, per granularity. */
const HALF_LIFE_MS: Record<DateGranularity, number> = {
  day: 2 * DAY_MS,
  month: 14 * DAY_MS,
  year: 60 * DAY_MS,
};

/** Lowercase, accent-free form. Kept local so `lib/` need not import domain. */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

interface Token {
  raw: string;
  start: number;
  end: number;
  folded: string;
}

function tokenize(query: string): Token[] {
  const out: Token[] = [];
  for (const match of query.matchAll(/[\p{L}\p{N}]+/gu)) {
    const start = match.index ?? 0;
    out.push({
      raw: match[0],
      start,
      end: start + match[0].length,
      folded: fold(match[0]),
    });
  }
  return out;
}

function isNumeric(token: Token | undefined): token is Token {
  return token !== undefined && /^\d+$/.test(token.folded);
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function rangeFor(
  granularity: DateGranularity,
  year: number,
  monthIndex: number,
  day: number,
): { from: Date; to: Date } {
  switch (granularity) {
    case "year":
      return { from: new Date(year, 0, 1), to: new Date(year + 1, 0, 1) };
    case "month":
      return {
        from: new Date(year, monthIndex, 1),
        to: new Date(year, monthIndex + 1, 1),
      };
    case "day":
      return {
        from: new Date(year, monthIndex, day),
        to: new Date(year, monthIndex, day + 1),
      };
  }
}

/**
 * Month names for the active locale plus an English fallback, folded to their
 * comparison form. Long and short (`marzo`, `mar`, `March`, `Mar`) both map to
 * their zero-based index. Derived from `Intl` so no month list is hardcoded.
 */
function monthIndex(locale: string | undefined): Map<string, number> {
  const map = new Map<string, number>();
  const add = (loc: string) => {
    const long = new Intl.DateTimeFormat(loc, { month: "long" });
    const short = new Intl.DateTimeFormat(loc, { month: "short" });
    for (let m = 0; m < 12; m++) {
      const probe = new Date(2021, m, 15);
      map.set(fold(long.format(probe)), m);
      map.set(fold(short.format(probe)), m);
    }
  };
  if (locale) add(locale);
  add("en");
  return map;
}

/**
 * Whether the locale writes day before month. Read from `Intl` field order
 * rather than guessed, so `5/3/2026` is the 5th of March under `es` and the
 * 3rd of May under `en-US` — the genuine source of the D/M vs M/D ambiguity.
 */
function dayBeforeMonth(locale: string | undefined): boolean {
  const parts = new Intl.DateTimeFormat(locale).formatToParts(
    new Date(2021, 5, 15),
  );
  const day = parts.findIndex((p) => p.type === "day");
  const month = parts.findIndex((p) => p.type === "month");
  if (day < 0 || month < 0) return true;
  return day < month;
}

const PLAUSIBLE_YEAR = { min: 1970, max: 2100 };

function asYear(token: Token | undefined): number | null {
  if (!isNumeric(token) || token.folded.length !== 4) return null;
  const value = Number(token.folded);
  return value >= PLAUSIBLE_YEAR.min && value <= PLAUSIBLE_YEAR.max
    ? value
    : null;
}

/** `agosto 2025`, `5 de marzo`, `5 marzo 2026`, `marzo`, `2025`. */
function matchWords(
  source: string,
  tokens: Token[],
  months: Map<string, number>,
  now: Date,
): DateQuery | null {
  for (let i = 0; i < tokens.length; i++) {
    const month = months.get(tokens[i]!.folded);
    if (month === undefined) continue;

    // A day may sit right before the month, optionally with "de"/"of" between.
    let firstIdx = i;
    let day: number | null = null;
    const prev = tokens[i - 1];
    const prevIsJoiner = prev?.folded === "de" || prev?.folded === "of";
    const dayTok = prevIsJoiner ? tokens[i - 2] : prev;
    if (isNumeric(dayTok) && dayTok.folded.length <= 2) {
      const value = Number(dayTok.folded);
      if (value >= 1 && value <= 31) {
        day = value;
        firstIdx = prevIsJoiner ? i - 2 : i - 1;
      }
    }

    // A year may follow, optionally after "de"/"of".
    let lastIdx = i;
    const next = tokens[i + 1];
    const nextIsJoiner = next?.folded === "de" || next?.folded === "of";
    const yearTok = nextIsJoiner ? tokens[i + 2] : next;
    let year = asYear(yearTok);
    if (year !== null) {
      lastIdx = nextIsJoiner ? i + 2 : i + 1;
    } else {
      year = now.getFullYear();
    }

    let granularity: DateGranularity = day !== null ? "day" : "month";
    if (day !== null && day > daysInMonth(year, month)) {
      // 31 February and friends: keep the month, drop the impossible day.
      day = null;
      granularity = "month";
      firstIdx = i;
    }

    const { from, to } = rangeFor(granularity, year, month, day ?? 1);
    return {
      from,
      to,
      granularity,
      matchedText: sliceTokens(source, tokens, firstIdx, lastIdx),
    };
  }

  // No month name: a bare four-digit year is still a date.
  for (const token of tokens) {
    const year = asYear(token);
    if (year !== null) {
      const { from, to } = rangeFor("year", year, 0, 1);
      return { from, to, granularity: "year", matchedText: token.raw };
    }
  }
  return null;
}

/** `5/3/2026`, `3/2026`, `5/3` — ambiguity resolved by locale field order. */
function matchNumeric(
  query: string,
  dmy: boolean,
  now: Date,
): DateQuery | null {
  const full = query.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (full) {
    const a = Number(full[1]);
    const b = Number(full[2]);
    let year = Number(full[3]);
    if (year < 100) year += 2000;
    const day = dmy ? a : b;
    const month = (dmy ? b : a) - 1;
    if (month >= 0 && month <= 11 && day >= 1 && day <= daysInMonth(year, month)) {
      const { from, to } = rangeFor("day", year, month, day);
      return { from, to, granularity: "day", matchedText: full[0] };
    }
  }

  const monthYear = query.match(/\b(\d{1,2})\/(\d{4})\b/);
  if (monthYear) {
    const month = Number(monthYear[1]) - 1;
    const year = Number(monthYear[2]);
    if (month >= 0 && month <= 11 && year >= PLAUSIBLE_YEAR.min) {
      const { from, to } = rangeFor("month", year, month, 1);
      return { from, to, granularity: "month", matchedText: monthYear[0] };
    }
  }

  const dayMonth = query.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (dayMonth) {
    const a = Number(dayMonth[1]);
    const b = Number(dayMonth[2]);
    const day = dmy ? a : b;
    const month = (dmy ? b : a) - 1;
    const year = now.getFullYear();
    if (month >= 0 && month <= 11 && day >= 1 && day <= daysInMonth(year, month)) {
      const { from, to } = rangeFor("day", year, month, day);
      return { from, to, granularity: "day", matchedText: dayMonth[0] };
    }
  }
  return null;
}

const RELATIVE_UNIT: Record<string, "day" | "week" | "month" | "year"> = {
  dia: "day",
  dias: "day",
  day: "day",
  days: "day",
  semana: "week",
  semanas: "week",
  week: "week",
  weeks: "week",
  mes: "month",
  meses: "month",
  month: "month",
  months: "month",
  ano: "year",
  anos: "year",
  year: "year",
  years: "year",
};

function startOfWeek(base: Date): Date {
  const day = base.getDay();
  const backToMonday = (day + 6) % 7;
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() - backToMonday,
  );
}

function shiftedRange(
  unit: "day" | "week" | "month" | "year",
  amount: number,
  now: Date,
): { from: Date; to: Date; granularity: DateGranularity } {
  switch (unit) {
    case "day": {
      const from = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - amount,
      );
      return { from, to: new Date(from.getTime() + DAY_MS), granularity: "day" };
    }
    case "week": {
      const from = new Date(startOfWeek(now).getTime() - amount * 7 * DAY_MS);
      return {
        from,
        to: new Date(from.getTime() + 7 * DAY_MS),
        granularity: "day",
      };
    }
    case "month": {
      const from = new Date(now.getFullYear(), now.getMonth() - amount, 1);
      return {
        from,
        to: new Date(from.getFullYear(), from.getMonth() + 1, 1),
        granularity: "month",
      };
    }
    case "year": {
      const year = now.getFullYear() - amount;
      return {
        from: new Date(year, 0, 1),
        to: new Date(year + 1, 0, 1),
        granularity: "year",
      };
    }
  }
}

/** `ayer`, `la semana pasada`, `el mes pasado`, `hace 3 meses`, English too. */
function matchRelative(source: string, tokens: Token[], now: Date): DateQuery | null {
  const done = (
    range: { from: Date; to: Date; granularity: DateGranularity },
    first: number,
    last: number,
  ): DateQuery => ({ ...range, matchedText: sliceTokens(source, tokens, first, last) });

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!.folded;
    const next = tokens[i + 1]?.folded;
    const after = tokens[i + 2]?.folded;

    if (t === "ayer" || t === "yesterday") {
      return done(shiftedRange("day", 1, now), i, i);
    }
    if (t === "hoy" || t === "today") {
      return done(shiftedRange("day", 0, now), i, i);
    }

    // "hace 3 meses" / "3 months ago"
    if (t === "hace" && isNumeric(tokens[i + 1]) && after && RELATIVE_UNIT[after]) {
      return done(shiftedRange(RELATIVE_UNIT[after]!, Number(next), now), i, i + 2);
    }
    if (isNumeric(tokens[i]) && next && RELATIVE_UNIT[next] && after === "ago") {
      return done(shiftedRange(RELATIVE_UNIT[next]!, Number(t), now), i, i + 2);
    }

    // "(el|la) <unit> pasad[oa]" / "last <unit>"
    const passed = next === "pasado" || next === "pasada";
    if (RELATIVE_UNIT[t] && passed) {
      const article = tokens[i - 1]?.folded;
      const first = article === "el" || article === "la" ? i - 1 : i;
      return done(shiftedRange(RELATIVE_UNIT[t]!, 1, now), first, i + 1);
    }
    if (t === "last" && next && RELATIVE_UNIT[next]) {
      return done(shiftedRange(RELATIVE_UNIT[next]!, 1, now), i, i + 1);
    }

    // "(este|esta) <unit>" / "this <unit>"
    if ((t === "este" || t === "esta" || t === "this") && next && RELATIVE_UNIT[next]) {
      return done(shiftedRange(RELATIVE_UNIT[next]!, 0, now), i, i + 1);
    }
  }
  return null;
}

function sliceTokens(
  source: string,
  tokens: Token[],
  first: number,
  last: number,
): string {
  // Slice the original span so the matched text keeps the query's exact
  // spacing and joiner words — `withoutDateText` finds it back verbatim.
  return source.slice(tokens[first]!.start, tokens[last]!.end);
}

/**
 * Read a date expression out of `query`. Returns `null` when the query carries
 * no date, so callers can treat it as ordinary text.
 */
export function parseDateQuery(
  query: string,
  options: ParseDateOptions = {},
): DateQuery | null {
  const trimmed = query.trim();
  if (trimmed.length === 0) return null;
  const now = options.now ?? new Date();
  const tokens = tokenize(trimmed);

  return (
    matchRelative(trimmed, tokens, now) ??
    matchNumeric(trimmed, dayBeforeMonth(options.locale), now) ??
    matchWords(trimmed, tokens, monthIndex(options.locale), now)
  );
}

/**
 * Proximity of a note's creation date to the parsed range, in [0, 1]. Notes
 * inside the range score 1.0; outside, the score decays with a half-life tied
 * to the granularity (a note three days off a `day` query is a weak match, but
 * squarely inside a `month` one). A decay rather than a hard filter: the user
 * asked for the nearest note, so a month with no notes must still return its
 * neighbours, not an empty list.
 */
export function scoreDateProximity(createdAtIso: string, query: DateQuery): number {
  const created = Date.parse(createdAtIso);
  if (Number.isNaN(created)) return 0;
  const from = query.from.getTime();
  const to = query.to.getTime();
  if (created >= from && created < to) return 1;
  const distance = created < from ? from - created : created - to;
  return Math.pow(2, -distance / HALF_LIFE_MS[query.granularity]);
}

/** The query with its date expression removed — what a mixed query embeds. */
export function withoutDateText(query: string, dateQuery: DateQuery): string {
  const idx = query.indexOf(dateQuery.matchedText);
  if (idx < 0) return query.trim();
  const rest =
    query.slice(0, idx) + " " + query.slice(idx + dateQuery.matchedText.length);
  return rest.replace(/\s+/g, " ").trim();
}

/**
 * Human-readable label for the resolved range, shown in the palette so a date
 * reinterpretation of "marzo" is visible rather than silent.
 */
export function formatDateQueryLabel(
  query: DateQuery,
  locale?: string,
): string {
  if (query.granularity === "year") {
    return String(query.from.getFullYear());
  }
  if (query.granularity === "month") {
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(query.from);
  }
  const spanDays = Math.round((query.to.getTime() - query.from.getTime()) / DAY_MS);
  const fmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  if (spanDays <= 1) return fmt.format(query.from);
  const lastDay = new Date(query.to.getTime() - DAY_MS);
  return fmt.formatRange(query.from, lastDay);
}

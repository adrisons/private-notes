import { describe, it, expect } from "vitest";
import {
  parseDateQuery,
  scoreDateProximity,
  withoutDateText,
  type DateQuery,
} from "../parse-date-query";

/**
 * The parser is the load-bearing part of date-aware search, and its two known
 * traps are timezones (a UTC `createdAt` sliced as a string lands on the wrong
 * local day) and numeric ambiguity (`5/3` is D/M or M/D by locale). Both get
 * their own cases below; the rest is a query → range table.
 */

// A reference "now" so bare months and relative expressions are deterministic.
const NOW = new Date(2026, 6, 21, 12, 0, 0); // 21 July 2026, local time.

function parse(query: string, locale = "es"): DateQuery {
  const result = parseDateQuery(query, { locale, now: NOW });
  expect(result, `"${query}" should parse as a date`).not.toBeNull();
  return result!;
}

describe("parseDateQuery — word forms", () => {
  const cases: Array<{
    query: string;
    locale?: string;
    from: Date;
    to: Date;
    granularity: DateQuery["granularity"];
    matchedText?: string;
  }> = [
    {
      query: "2025",
      from: new Date(2025, 0, 1),
      to: new Date(2026, 0, 1),
      granularity: "year",
    },
    {
      query: "agosto 2025",
      from: new Date(2025, 7, 1),
      to: new Date(2025, 8, 1),
      granularity: "month",
    },
    {
      query: "March 2025",
      locale: "en",
      from: new Date(2025, 2, 1),
      to: new Date(2025, 3, 1),
      granularity: "month",
    },
    {
      query: "mar 2025",
      from: new Date(2025, 2, 1),
      to: new Date(2025, 3, 1),
      granularity: "month",
    },
    {
      // Bare month resolves against "now"'s year.
      query: "marzo",
      from: new Date(2026, 2, 1),
      to: new Date(2026, 3, 1),
      granularity: "month",
    },
    {
      query: "5 marzo 2026",
      from: new Date(2026, 2, 5),
      to: new Date(2026, 2, 6),
      granularity: "day",
    },
    {
      query: "5 de marzo",
      from: new Date(2026, 2, 5),
      to: new Date(2026, 2, 6),
      granularity: "day",
      matchedText: "5 de marzo",
    },
    {
      // Mixed query: only the date part is matched, the rest is left alone.
      query: "pescado agosto 2025",
      from: new Date(2025, 7, 1),
      to: new Date(2025, 8, 1),
      granularity: "month",
      matchedText: "agosto 2025",
    },
  ];

  it.each(cases)("$query", ({ query, locale, from, to, granularity, matchedText }) => {
    const result = parse(query, locale);
    expect(result.from.getTime()).toBe(from.getTime());
    expect(result.to.getTime()).toBe(to.getTime());
    expect(result.granularity).toBe(granularity);
    if (matchedText) expect(result.matchedText).toBe(matchedText);
  });

  it("returns null for a query with no date", () => {
    expect(parseDateQuery("pescado blanco", { locale: "es" })).toBeNull();
    expect(parseDateQuery("", { locale: "es" })).toBeNull();
    // A bare number that is not a plausible year is not a date.
    expect(parseDateQuery("1234", { locale: "es" })).toBeNull();
  });
});

describe("parseDateQuery — numeric D/M vs M/D ambiguity", () => {
  it("reads 5/3/2026 as 5 March under a day-first locale", () => {
    const result = parse("5/3/2026", "es");
    expect(result.from.getTime()).toBe(new Date(2026, 2, 5).getTime());
    expect(result.granularity).toBe("day");
  });

  it("reads 5/3/2026 as 3 May under a month-first locale", () => {
    const result = parse("5/3/2026", "en-US");
    expect(result.from.getTime()).toBe(new Date(2026, 4, 3).getTime());
    expect(result.granularity).toBe("day");
  });

  it("reads a four-digit tail as month/year", () => {
    const result = parse("3/2026", "es");
    expect(result.from.getTime()).toBe(new Date(2026, 2, 1).getTime());
    expect(result.granularity).toBe("month");
  });

  it("resolves a yearless slash form against now", () => {
    const result = parse("5/3", "es");
    expect(result.from.getTime()).toBe(new Date(2026, 2, 5).getTime());
  });
});

describe("parseDateQuery — relative expressions", () => {
  it("ayer / yesterday is the day before now", () => {
    const yesterday = new Date(2026, 6, 20);
    for (const q of ["ayer", "yesterday"]) {
      const result = parse(q, "es");
      expect(result.from.getTime()).toBe(yesterday.getTime());
      expect(result.granularity).toBe("day");
    }
  });

  it("el mes pasado / last month is the previous calendar month", () => {
    for (const q of ["el mes pasado", "last month"]) {
      const result = parse(q, "es");
      expect(result.from.getTime()).toBe(new Date(2026, 5, 1).getTime());
      expect(result.to.getTime()).toBe(new Date(2026, 6, 1).getTime());
      expect(result.granularity).toBe("month");
    }
  });

  it("hace 3 meses / 3 months ago is the month three back", () => {
    for (const q of ["hace 3 meses", "3 months ago"]) {
      const result = parse(q, "es");
      expect(result.from.getTime()).toBe(new Date(2026, 3, 1).getTime());
      expect(result.granularity).toBe("month");
    }
  });

  it("la semana pasada spans seven days ending before this week", () => {
    const result = parse("la semana pasada", "es");
    const span = (result.to.getTime() - result.from.getTime()) / 86_400_000;
    expect(span).toBe(7);
    expect(result.from.getTime()).toBeLessThan(NOW.getTime());
  });
});

describe("scoreDateProximity", () => {
  const march2026: DateQuery = {
    from: new Date(2026, 2, 1),
    to: new Date(2026, 3, 1),
    granularity: "month",
    matchedText: "marzo 2026",
  };

  it("scores 1.0 inside the range", () => {
    const created = new Date(2026, 2, 15, 10, 0).toISOString();
    expect(scoreDateProximity(created, march2026)).toBe(1);
  });

  it("keeps a note created late on the last local day inside the month", () => {
    // The timezone trap: 23:59 local on 31 March is stored as an April UTC
    // instant in any negative-offset zone. Comparing the instant against a
    // local range keeps it in March; a naive UTC day-slice would not.
    const lastMoment = new Date(2026, 2, 31, 23, 59).toISOString();
    expect(scoreDateProximity(lastMoment, march2026)).toBe(1);
    // A few days into April is genuinely outside and decays below 1. (The
    // exact midnight boundary scores 1.0 by continuity — distance zero — which
    // is the intended, harmless edge.)
    const deepIntoApril = new Date(2026, 3, 5, 0, 0).toISOString();
    expect(scoreDateProximity(deepIntoApril, march2026)).toBeLessThan(1);
  });

  it("keeps the day before the range out of it", () => {
    const feb28 = new Date(2026, 1, 28, 23, 59).toISOString();
    expect(scoreDateProximity(feb28, march2026)).toBeLessThan(1);
  });

  it("decays with distance, and a year off scores near zero", () => {
    const oneWeekOut = new Date(2026, 3, 8).toISOString(); // ~a week after March.
    const yearOff = new Date(2025, 2, 15).toISOString();
    const near = scoreDateProximity(oneWeekOut, march2026);
    const far = scoreDateProximity(yearOff, march2026);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeLessThan(0.05);
  });

  it("scales the decay to granularity — a year query is far more forgiving", () => {
    const year2026: DateQuery = {
      from: new Date(2026, 0, 1),
      to: new Date(2027, 0, 1),
      granularity: "year",
      matchedText: "2026",
    };
    const created = new Date(2025, 11, 20).toISOString(); // ~11 days before 2026.
    // The same 11-day gap is a weak match for a day query but a strong one
    // for a year query.
    expect(scoreDateProximity(created, year2026)).toBeGreaterThan(
      scoreDateProximity(created, march2026),
    );
  });
});

describe("withoutDateText", () => {
  it("removes the matched date and collapses the remainder", () => {
    const dq = parse("pescado agosto 2025", "es");
    expect(withoutDateText("pescado agosto 2025", dq)).toBe("pescado");
  });

  it("is empty for a pure date query", () => {
    const dq = parse("agosto 2025", "es");
    expect(withoutDateText("agosto 2025", dq)).toBe("");
  });
});

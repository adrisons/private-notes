/**
 * Relevance regression net.
 *
 * Ranking changes are the kind
 * of work that gets tuned by feel and silently undone six months later. This
 * corpus plus its query table is the contract those changes are measured
 * against: a tuning that breaks a case here is a regression until the case
 * itself is argued down.
 *
 * **What this can and cannot prove.** The tests drive the real pipeline —
 * vault on disk → indexer → hybrid retrieval → palette ranking — but with
 * `FakeEmbedder`, whose "semantics" are a hashed bag of words. So these cases
 * guard *plumbing and ranking policy*: that titles reach the index at all,
 * that an exact title match outranks a mid-range cosine, that accents and case
 * fold, that one merged list is produced instead of two concatenated ones.
 * They cannot guard paraphrase recall ("comida de mar" → a fish recipe) —
 * that is a property of the production model and has to be measured against it
 * in a browser, not asserted here.
 *
 * **Why concept queries work anyway.** "africa" finds Moroccan recipes, an
 * Egyptian trip and an offsite in Marrakech — not because a model knows where
 * Marrakech is, but because those notes share a *space* the user created, and
 * a space name is a ranking signal (ADR-010). That is a deliberate choice: it
 * is deterministic, testable, and it degrades honestly. Notes the user never
 * filed are not found by concept, and no amount of model quality changes that.
 *
 * The corpus is Spanish and mixes the three things a real vault mixes:
 * recipes, travel and a work journal. Spaces cut across those on purpose —
 * "África" holds notes from all three, which is what makes the concept query
 * meaningful rather than a synonym for "Recetas".
 *
 * §2 (date-aware search) will extend this table with date queries. Note that
 * `marruecos 2020` below matches the *text* "2020", not the note's creation
 * date; making that distinction real is exactly what §2 is for, and these
 * fixtures will need per-note creation dates when it lands.
 */

export interface RelevanceNote {
  /** Stable fixture handle. Vault note ids are generated, so cases key on this. */
  key: string;
  title: string;
  body: string;
  /** Spaces the note is filed under, by name. Notes can span several. */
  spaceNames?: string[];
}

export interface RelevanceCase {
  query: string;
  /** Human-readable justification — surfaced on failure. */
  reason: string;
  /** Must all appear within the top 3, in any order among themselves. */
  expectedTop?: string[];
  /** Must be the single best result. */
  first?: string;
  /** Must all appear somewhere in the results — the "several answers" cases. */
  expectedAll?: string[];
  /** Must rank below every `expectedTop` id. Absent from the list also passes. */
  rankedBelow?: string[];
  /** Must not appear at all. */
  excluded?: string[];
  /** Upper bound on the result count — guards the "eight weak hits" symptom. */
  maxResults?: number;
}

export const SPACES = {
  recetas: "Recetas",
  viajes: "Viajes",
  trabajo: "Trabajo",
  africa: "África",
} as const;

export const RELEVANCE_NOTES: RelevanceNote[] = [
  // ---------------------------------------------------------------- recetas
  {
    key: "tiradito",
    title: "Tiradito de pescado",
    body:
      "Corta el lomo en láminas muy finas. Mezcla la leche de tigre con ají amarillo y lima. Sirve bien frío con cebolla morada encima.",
    spaceNames: [SPACES.recetas],
  },
  {
    key: "chermoula",
    title: "Chermoula para pescado",
    body:
      "Clásico de Marruecos: cilantro, perejil, comino, pimentón y ajo majados con aceite de oliva. Marina el lomo dos horas antes de asarlo.",
    spaceNames: [SPACES.recetas, SPACES.africa],
  },
  {
    key: "ceviche",
    title: "Ceviche clásico",
    body:
      "Dados de pescado blanco, zumo de lima, cebolla morada, cilantro y ají limo. Reposa cinco minutos y sirve al momento.",
    spaceNames: [SPACES.recetas],
  },
  {
    key: "merluza",
    title: "Merluza al horno",
    body:
      "Coloca los lomos sobre patatas panadera con ajo y perejil. Hornea veinte minutos a doscientos grados.",
    spaceNames: [SPACES.recetas],
  },
  {
    key: "hummus",
    title: "Hummus casero",
    body:
      "Garbanzos cocidos, tahini, zumo de limón, ajo y un chorro de aceite. Plato vegetariano, sale mejor si pelas los garbanzos.",
    spaceNames: [SPACES.recetas, SPACES.africa],
  },
  {
    key: "falafel",
    title: "Falafel de garbanzo",
    body:
      "Garbanzos crudos en remojo, cilantro, comino y cebolla. Fríe en aceite bien caliente. Vegetariano y aguanta bien de un día para otro.",
    spaceNames: [SPACES.recetas, SPACES.africa],
  },
  {
    key: "tagine",
    title: "Tagine de verduras",
    body:
      "Zanahoria, calabaza, garbanzos y ciruelas con ras el hanout. Guiso vegetariano, a fuego muy lento y tapado.",
    spaceNames: [SPACES.recetas, SPACES.africa],
  },
  {
    key: "koshari",
    title: "Koshari egipcio",
    body:
      "Lentejas, arroz y macarrones con salsa de tomate y cebolla frita. Vegetariano, el plato de calle más común en El Cairo.",
    spaceNames: [SPACES.recetas, SPACES.africa],
  },
  {
    key: "raita",
    title: "Raita de pepino",
    body:
      "Yogur griego, pepino rallado, hierbabuena y comino molido. Vegetariano, acompaña bien los currys picantes.",
    spaceNames: [SPACES.recetas],
  },
  {
    key: "carbonara",
    title: "Pasta a la carbonara",
    body:
      "Guanciale, yema de huevo, pecorino y pimienta negra. Nunca lleva nata.",
    spaceNames: [SPACES.recetas],
  },
  {
    key: "lentejas",
    title: "Lentejas de la abuela",
    body:
      "Sofríe cebolla, zanahoria y pimiento. Añade el chorizo y una hoja de laurel. Cuece cuarenta minutos a fuego lento.",
    spaceNames: [SPACES.recetas],
  },
  {
    key: "arroz",
    title: "Arroz caldoso de marisco",
    body:
      "Fumet, gambas, almejas y sepia. Añade el arroz y cuece dieciocho minutos sin remover.",
    spaceNames: [SPACES.recetas],
  },
  {
    key: "limonada",
    title: "Limonada de menta",
    body: "Zumo de limón, agua muy fría, hojas de menta y un poco de azúcar.",
    spaceNames: [SPACES.recetas],
  },
  {
    key: "masamadre",
    title: "Pan de masa madre",
    body:
      "Harina de fuerza, agua, sal y masa madre activa. Fermentación en frío durante doce horas.",
    spaceNames: [SPACES.recetas],
  },

  // ----------------------------------------------------------------- viajes
  {
    key: "marrakech",
    title: "Marrakech en cuatro días",
    body:
      "Viaje de marzo de 2020 por Marruecos. Zoco, medina y un riad con terraza. Té a la menta a todas horas y una excursión a las cascadas.",
    spaceNames: [SPACES.viajes, SPACES.africa],
  },
  {
    key: "egipto",
    title: "Nilo y El Cairo",
    body:
      "Crucero desde Luxor, pirámides al amanecer y el museo nuevo. Regatear es obligatorio. Egipto en once días.",
    spaceNames: [SPACES.viajes, SPACES.africa],
  },
  {
    key: "tunez",
    title: "Túnez y el desierto",
    body:
      "Dunas en Douz, noche en jaima y ruinas romanas en Dougga. El Sáhara empieza justo detrás del pueblo.",
    spaceNames: [SPACES.viajes, SPACES.africa],
  },
  {
    key: "japon",
    title: "Presupuesto del viaje a Japón",
    body:
      "Vuelos, alojamiento en Kioto y transporte interno. Conviene reservar el pase de tren con antelación.",
    spaceNames: [SPACES.viajes],
  },
  {
    key: "lisboa",
    title: "Fin de semana en Lisboa",
    body:
      "Miradores de Alfama, tranvía 28 y pastéis recién hechos. Se anda mucho y todo es cuesta.",
    spaceNames: [SPACES.viajes],
  },
  {
    key: "andes",
    title: "Ruta por los Andes",
    body:
      "Cusco, valle sagrado y tres días de altura. Hoja de coca desde el primer momento.",
    spaceNames: [SPACES.viajes],
  },
  {
    key: "islandia",
    title: "Islandia en coche",
    body:
      "Carretera de circunvalación en nueve días, cascadas y aguas termales. El viento abre las puertas del coche.",
    spaceNames: [SPACES.viajes],
  },
  {
    key: "roma",
    title: "Roma en tres días",
    body:
      "Foro, Trastevere y una cena larga cerca del Panteón. Entradas compradas con antelación.",
    spaceNames: [SPACES.viajes],
  },
  {
    key: "equipaje",
    title: "Lista de equipaje",
    body:
      "Adaptador, cargador, botiquín pequeño y una muda de más. Revisar siempre el peso de la maleta de cabina.",
    spaceNames: [SPACES.viajes],
  },

  // ---------------------------------------------------------------- trabajo
  {
    key: "offsite",
    title: "Reunión de equipo en Marrakech",
    body:
      "Offsite de 2020: dos días de trabajo y uno libre. Cerramos la hoja de ruta y repartimos responsabilidades del trimestre.",
    spaceNames: [SPACES.trabajo, SPACES.africa],
  },
  {
    key: "producto",
    title: "Reunión de producto",
    body:
      "Revisamos las prioridades del trimestre y decidimos invertir en el buscador semántico antes que en la exportación.",
    spaceNames: [SPACES.trabajo],
  },
  {
    key: "retro",
    title: "Retrospectiva del trimestre",
    body:
      "Lo que funcionó: despliegues pequeños. Lo que no: estimaciones optimistas y demasiado trabajo en paralelo.",
    spaceNames: [SPACES.trabajo],
  },
  {
    key: "onboarding",
    title: "Onboarding de Ana",
    body:
      "Accesos el primer día, una tarea pequeña de verdad la primera semana y una persona de referencia asignada.",
    spaceNames: [SPACES.trabajo],
  },
  {
    key: "presupuesto",
    title: "Presupuesto del equipo 2020",
    body:
      "Formación, herramientas y un margen para viajes. Revisión trimestral con finanzas.",
    spaceNames: [SPACES.trabajo],
  },
  {
    key: "incidencia",
    title: "Incidencia del despliegue",
    body:
      "Caída de veinte minutos por una migración sin índice. Falta una comprobación previa en el proceso.",
    spaceNames: [SPACES.trabajo],
  },

  // --------------------------------------------------------------- sin space
  {
    key: "cafe",
    title: "Métodos de café",
    body:
      "Prensa francesa, goteo y aeropress. Molienda media y agua a noventa y dos grados.",
  },
  {
    key: "plantas",
    title: "Cuidado de las plantas",
    body: "Riega el potos una vez por semana y evita el sol directo del mediodía.",
  },
  {
    key: "libros",
    title: "Libros pendientes",
    body:
      "Terminar la trilogía de ciencia ficción y empezar el ensayo sobre la atención.",
  },
];

export const RELEVANCE_CASES: RelevanceCase[] = [
  // ---------------------------------------------- the bug that started this
  {
    query: "pescado",
    reason:
      "The reported bug: the word lives only in two titles, which must beat every unrelated recipe.",
    expectedTop: ["tiradito", "chermoula"],
    expectedAll: ["tiradito", "chermoula", "ceviche"],
    rankedBelow: ["raita", "carbonara"],
  },
  {
    query: "PESCADO",
    reason: "Case folding — an uppercase query is the same query.",
    expectedTop: ["tiradito", "chermoula"],
  },
  {
    query: "Tiradito de pescado",
    reason: "An exact title match must be unbeatable by any cosine score.",
    first: "tiradito",
  },
  {
    query: "chermoula",
    reason:
      "The word appears in no body anywhere in the vault — this fails outright if titles are not indexed.",
    first: "chermoula",
  },

  // ------------------------------------------------- concept queries: spaces
  {
    query: "africa",
    reason:
      "The concept query. One space cuts across all three parts of the vault, so a recipe, a trip and a work offsite must all come back — with no model involved.",
    expectedAll: [
      "hummus",
      "falafel",
      "tagine",
      "koshari",
      "chermoula",
      "marrakech",
      "egipto",
      "tunez",
      "offsite",
    ],
    excluded: ["carbonara", "roma", "plantas"],
  },
  {
    query: "áfrica",
    reason: "The accented spelling of a space name is the same space.",
    expectedAll: ["hummus", "marrakech", "offsite"],
  },
  {
    query: "viajes",
    reason:
      "A space with no thematic overlap: every filed trip, and nothing from the kitchen.",
    expectedAll: ["marrakech", "japon", "lisboa", "islandia", "equipaje"],
    excluded: ["carbonara", "retro"],
  },
  {
    query: "trabajo",
    reason: "The work journal, reachable as a concept rather than by wording.",
    expectedAll: ["offsite", "producto", "retro", "onboarding", "incidencia"],
  },

  // --------------------------------------------- several answers, one term
  {
    query: "garbanzo",
    reason:
      "Three recipes use it and none says so in the title — a body-only term with several right answers.",
    expectedAll: ["hummus", "falafel", "tagine"],
  },
  {
    query: "vegetariano",
    reason:
      "A label people actually write in their notes; every recipe carrying it must come back.",
    expectedAll: ["hummus", "falafel", "tagine", "koshari", "raita"],
    excluded: ["carbonara", "lentejas"],
  },
  {
    query: "marruecos",
    reason:
      "A country named in two bodies from different parts of the vault — a recipe and a trip.",
    expectedAll: ["chermoula", "marrakech"],
  },
  {
    query: "reunion",
    reason:
      "Two notes whose titles both start with it; both are right answers.",
    expectedAll: ["offsite", "producto"],
  },
  {
    query: "limon",
    reason:
      "Accent folding with two right answers: the title of one note and the body of another.",
    expectedAll: ["limonada", "hummus"],
  },
  {
    query: "trimestre",
    reason:
      "A word shared by four work notes — including `presupuesto`, which says 'trimestral'. That derivation is not folded (gender and number are, derivations are not); it is reached because the folded query 'trimestr' is a prefix of it. Prefix matching is doing double duty as a poor man's stemmer here.",
    expectedAll: ["producto", "retro", "offsite", "presupuesto"],
  },

  // ------------------------------------------------------ multi-term queries
  {
    query: "receta vegetariana",
    reason:
      "The mixed shape: one term names a space, the other selects inside it. Note the notes say 'vegetariano' and the query says 'vegetariana' — as real notes and real queries do. Filing alone must not be enough: the non-vegetarian recipes share the space and must stay out.",
    expectedAll: ["hummus", "falafel", "tagine", "koshari", "raita"],
    excluded: ["carbonara", "lentejas", "arroz"],
  },
  {
    query: "marruecos 2020",
    reason:
      "Multi-term across metadata-ish text: the note carrying both beats the ones carrying either. The year matches as text, not as a creation date",
    first: "marrakech",
    expectedAll: ["marrakech", "offsite"],
  },
  {
    query: "pescado blanco",
    reason:
      "The note carrying both terms must rank above the notes carrying only one.",
    expectedAll: ["ceviche"],
  },
  {
    query: "masa madre",
    reason: "Multi-word title match.",
    first: "masamadre",
  },
  {
    query: "reunion producto",
    reason:
      "Two terms that together name one note, though both notes match 'reunion'.",
    first: "producto",
  },

  // ------------------------------------------------------- precision guards
  {
    query: "carbonara",
    reason:
      "One obviously right answer means a short list, not eight least-bad ones.",
    first: "carbonara",
    maxResults: 4,
  },
  {
    query: "chorizo",
    reason: "Body-only lexical match: dense retrieval alone tends to miss these.",
    expectedTop: ["lentejas"],
  },
  {
    query: "piramides",
    reason: "Accent folding on a body word, against a corpus full of trips.",
    first: "egipto",
  },
  {
    query: "japon",
    reason: "Accent folding on a proper noun in the title.",
    expectedTop: ["japon"],
  },
  {
    query: "cafe",
    reason: "Accent folding in the title of an unfiled note.",
    first: "cafe",
  },
  {
    query: "marisco",
    reason: "Trailing title word — position inside the title must not matter.",
    first: "arroz",
  },
  {
    query: "desierto",
    reason: "Body-only word with exactly one right answer.",
    first: "tunez",
  },
  {
    query: "plantas",
    reason: "Unfiled note with no competing occurrence.",
    first: "plantas",
  },
];

// Motor puro del cuadro de eliminatorias del Mundial 2026 (estructura oficial).
// Sin dependencias de servidor: se usa en cliente (cálculo en vivo) y en servidor (puntuación).

export type MiniMatch = {
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
};

export type StandingRow = {
  teamId: number;
  seed: number; // posición de bombo dentro del grupo (0..3)
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
};

/** Calcula la clasificación de un grupo a partir de los marcadores. */
export function computeGroupStandings(
  teams: { teamId: number; seed: number }[],
  matches: MiniMatch[]
): StandingRow[] {
  const rows = new Map<number, StandingRow>();
  for (const t of teams) {
    rows.set(t.teamId, {
      teamId: t.teamId,
      seed: t.seed,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      pts: 0,
    });
  }

  for (const m of matches) {
    if (m.homeScore == null || m.awayScore == null) continue;
    const h = rows.get(m.homeTeamId);
    const a = rows.get(m.awayTeamId);
    if (!h || !a) continue;
    h.played++;
    a.played++;
    h.gf += m.homeScore;
    h.ga += m.awayScore;
    a.gf += m.awayScore;
    a.ga += m.homeScore;
    if (m.homeScore > m.awayScore) {
      h.won++;
      h.pts += 3;
      a.lost++;
    } else if (m.homeScore < m.awayScore) {
      a.won++;
      a.pts += 3;
      h.lost++;
    } else {
      h.drawn++;
      a.drawn++;
      h.pts += 1;
      a.pts += 1;
    }
  }

  const list = [...rows.values()];
  for (const r of list) r.gd = r.gf - r.ga;
  list.sort(compareStandings);
  return list;
}

/** Orden: puntos → dif. goles → goles a favor → posición de bombo. */
function compareStandings(a: StandingRow, b: StandingRow): number {
  return b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.seed - b.seed;
}

export type ThirdTeam = { teamId: number; group: string };

/** De los 12 terceros, devuelve los 8 mejores (ranking global) con su grupo. */
export function selectBestThirds(
  thirds: { group: string; row: StandingRow }[]
): ThirdTeam[] {
  return [...thirds]
    .sort((a, b) => compareStandings(a.row, b.row))
    .slice(0, 8)
    .map((t) => ({ teamId: t.row.teamId, group: t.group }));
}

// ---------------------------------------------------------------------------
// Plantilla OFICIAL del cuadro (Mundial 2026, partidos 73-104)
// Fuente: https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage
// ---------------------------------------------------------------------------

export type SlotRef =
  | { k: "w"; g: string } // ganador (1º) del grupo g
  | { k: "r"; g: string } // segundo (2º) del grupo g
  | { k: "t"; allowed: string[] } // tercero clasificado de uno de estos grupos
  | { k: "m"; s: string } // ganador del cruce con slot s
  | { k: "l"; s: string }; // perdedor del cruce con slot s (partido por 3º puesto)

export type Round = "R32" | "R16" | "QF" | "SF" | "F" | "THIRD";

export type BracketSlot = {
  slot: string; // "R32-73".."F-104"
  round: Round;
  home: SlotRef;
  away: SlotRef;
};

const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

const w = (g: string): SlotRef => ({ k: "w", g });
const r = (g: string): SlotRef => ({ k: "r", g });
const t = (allowed: string): SlotRef => ({ k: "t", allowed: allowed.split("") });
const m = (s: string): SlotRef => ({ k: "m", s });

// Dieciseisavos (partidos 73-88). Los 't' indican de qué grupos puede salir el tercero.
const R32: BracketSlot[] = [
  { slot: "R32-73", round: "R32", home: r("A"), away: r("B") },
  { slot: "R32-74", round: "R32", home: w("E"), away: t("ABCDF") },
  { slot: "R32-75", round: "R32", home: w("F"), away: r("C") },
  { slot: "R32-76", round: "R32", home: w("C"), away: r("F") },
  { slot: "R32-77", round: "R32", home: w("I"), away: t("CDFGH") },
  { slot: "R32-78", round: "R32", home: r("E"), away: r("I") },
  { slot: "R32-79", round: "R32", home: w("A"), away: t("CEFHI") },
  { slot: "R32-80", round: "R32", home: w("L"), away: t("EHIJK") },
  { slot: "R32-81", round: "R32", home: w("D"), away: t("BEFIJ") },
  { slot: "R32-82", round: "R32", home: w("G"), away: t("AEHIJ") },
  { slot: "R32-83", round: "R32", home: r("K"), away: r("L") },
  { slot: "R32-84", round: "R32", home: w("H"), away: r("J") },
  { slot: "R32-85", round: "R32", home: w("B"), away: t("EFGIJ") },
  { slot: "R32-86", round: "R32", home: w("J"), away: r("H") },
  { slot: "R32-87", round: "R32", home: w("K"), away: t("DEIJL") },
  { slot: "R32-88", round: "R32", home: r("D"), away: r("G") },
];

const LATER: BracketSlot[] = [
  // Octavos (89-96)
  { slot: "R16-89", round: "R16", home: m("R32-74"), away: m("R32-77") },
  { slot: "R16-90", round: "R16", home: m("R32-73"), away: m("R32-75") },
  { slot: "R16-91", round: "R16", home: m("R32-76"), away: m("R32-78") },
  { slot: "R16-92", round: "R16", home: m("R32-79"), away: m("R32-80") },
  { slot: "R16-93", round: "R16", home: m("R32-83"), away: m("R32-84") },
  { slot: "R16-94", round: "R16", home: m("R32-81"), away: m("R32-82") },
  { slot: "R16-95", round: "R16", home: m("R32-86"), away: m("R32-88") },
  { slot: "R16-96", round: "R16", home: m("R32-85"), away: m("R32-87") },
  // Cuartos (97-100)
  { slot: "QF-97", round: "QF", home: m("R16-89"), away: m("R16-90") },
  { slot: "QF-98", round: "QF", home: m("R16-93"), away: m("R16-94") },
  { slot: "QF-99", round: "QF", home: m("R16-91"), away: m("R16-92") },
  { slot: "QF-100", round: "QF", home: m("R16-95"), away: m("R16-96") },
  // Semifinales (101-102)
  { slot: "SF-101", round: "SF", home: m("QF-97"), away: m("QF-98") },
  { slot: "SF-102", round: "SF", home: m("QF-99"), away: m("QF-100") },
  // Final (104)
  { slot: "F-104", round: "F", home: m("SF-101"), away: m("SF-102") },
  // Tercer puesto (103): perdedores de las semifinales
  { slot: "THIRD-103", round: "THIRD", home: { k: "l", s: "SF-101" }, away: { k: "l", s: "SF-102" } },
];

export const BRACKET: BracketSlot[] = [...R32, ...LATER];

// Huecos de tercero: slot + grupos admitidos (para el reparto de los 8 terceros).
const THIRD_SLOTS: { slot: string; allowed: string[] }[] = R32.filter(
  (b) => b.home.k === "t" || b.away.k === "t"
).map((b) => ({
  slot: b.slot,
  allowed: (b.home.k === "t" ? b.home : (b.away as Extract<SlotRef, { k: "t" }>)).allowed,
}));

export const ROUND_LABELS: Record<Round, string> = {
  R32: "16os",
  R16: "8os",
  QF: "4os",
  SF: "Semis",
  F: "Final",
  THIRD: "3º",
};

// Etiquetas cortas para tabs (estilo fracción)
export const ROUND_TAB_LABELS: Record<Round, string> = {
  R32: "1/16",
  R16: "1/8",
  QF: "1/4",
  SF: "1/2",
  F: "Final",
  THIRD: "3º puesto",
};

// Etiquetas largas para títulos de sección
export const ROUND_FULL_LABELS: Record<Round, string> = {
  R32: "Dieciseisavos",
  R16: "Octavos",
  QF: "Cuartos",
  SF: "Semifinal",
  F: "Final",
  THIRD: "Tercer puesto",
};

export const ROUND_ORDER: Round[] = ["R32", "R16", "QF", "SF", "F", "THIRD"];

export function roundOf(slot: string): string {
  return slot.split("-")[0];
}

/** Texto placeholder para un SlotRef cuando los equipos aún no están determinados. */
export function slotRefLabel(ref: SlotRef): string {
  if (ref.k === "w") return `1º${ref.g}`;
  if (ref.k === "r") return `2º${ref.g}`;
  if (ref.k === "t") return `3º${ref.allowed.join("/")}`;
  const round = ref.s.split("-")[0] as Round;
  const idx = BRACKET.filter((b) => b.round === round).findIndex((b) => b.slot === ref.s) + 1;
  if (ref.k === "l") return `Per.${ROUND_TAB_LABELS[round]}#${idx}`;
  // k === "m": ganador de otro cruce
  return `G.${ROUND_TAB_LABELS[round]}#${idx}`;
}

// ---------------------------------------------------------------------------
// Reparto de terceros (emparejamiento bipartito respetando los grupos admitidos)
// ---------------------------------------------------------------------------

/**
 * Asigna cada uno de los 8 terceros clasificados a un hueco de tercero respetando
 * los grupos admitidos por cada hueco. Devuelve slot → teamId.
 * Usa el algoritmo de Kuhn (matching bipartito máximo), determinista.
 */
function assignThirds(thirds: ThirdTeam[]): Record<string, number | null> {
  const slots = THIRD_SLOTS;
  const matchThird = new Array<number>(thirds.length).fill(-1); // tercero j → índice de slot
  const can = (si: number, tj: number) => slots[si].allowed.includes(thirds[tj].group);

  const augment = (si: number, seen: boolean[]): boolean => {
    for (let tj = 0; tj < thirds.length; tj++) {
      if (can(si, tj) && !seen[tj]) {
        seen[tj] = true;
        if (matchThird[tj] === -1 || augment(matchThird[tj], seen)) {
          matchThird[tj] = si;
          return true;
        }
      }
    }
    return false;
  };

  for (let si = 0; si < slots.length; si++) {
    augment(si, new Array<boolean>(thirds.length).fill(false));
  }

  const out: Record<string, number | null> = {};
  for (const s of slots) out[s.slot] = null;
  for (let tj = 0; tj < thirds.length; tj++) {
    if (matchThird[tj] !== -1) out[slots[matchThird[tj]].slot] = thirds[tj].teamId;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Resolución del cuadro
// ---------------------------------------------------------------------------

export type ResolvedSlot = {
  slot: string;
  round: Round;
  homeTeamId: number | null;
  awayTeamId: number | null;
  winnerTeamId: number | null;
};

export type GroupForStandings = {
  name: string;
  teams: { teamId: number; seed: number }[];
  matches: { id: number; homeTeamId: number; awayTeamId: number }[];
};

/** Marcador de un cruce: null por lado si no se ha rellenado; pen = ganador penaltis. */
export type SlotScore = {
  home: number | null;
  away: number | null;
  pen: number | null;
};

/**
 * Calcula la clasificación de cada grupo y los 8 mejores terceros a partir de
 * una función que devuelve el marcador (predicho o real) de cada partido.
 */
export function computeStandingsAndThirds(
  groups: GroupForStandings[],
  scoreOf: (matchId: number) => { home: number; away: number } | null
): { standingsByGroup: Record<string, number[]>; thirds: ThirdTeam[] } {
  const standingsByGroup: Record<string, number[]> = {};
  const thirdRows: { group: string; row: StandingRow }[] = [];

  for (const g of groups) {
    const mm: MiniMatch[] = g.matches.map((mt) => {
      const s = scoreOf(mt.id);
      return {
        homeTeamId: mt.homeTeamId,
        awayTeamId: mt.awayTeamId,
        homeScore: s ? s.home : null,
        awayScore: s ? s.away : null,
      };
    });
    const st = computeGroupStandings(g.teams, mm);
    standingsByGroup[g.name] = st.map((row) => row.teamId);
    if (st[2]) thirdRows.push({ group: g.name, row: st[2] });
  }

  return { standingsByGroup, thirds: selectBestThirds(thirdRows) };
}

/**
 * Resuelve todo el cuadro: equipos de cada cruce y ganador, derivando el ganador
 * del marcador (mayor marcador, o ganador de penaltis si hay empate).
 */
export function resolveWithScores(
  standingsByGroup: Record<string, number[]>,
  thirds: ThirdTeam[],
  getScore: (slot: string) => SlotScore
): Record<string, ResolvedSlot> {
  const thirdAssignment = assignThirds(thirds);
  const out: Record<string, ResolvedSlot> = {};
  const winners: Record<string, number | null> = {};

  const teamFor = (ref: SlotRef, slot: string): number | null => {
    switch (ref.k) {
      case "w":
        return standingsByGroup[ref.g]?.[0] ?? null;
      case "r":
        return standingsByGroup[ref.g]?.[1] ?? null;
      case "t":
        return thirdAssignment[slot] ?? null;
      case "m":
        return winners[ref.s] ?? null;
      case "l": {
        const r = out[ref.s];
        if (!r || r.winnerTeamId == null) return null;
        return r.homeTeamId === r.winnerTeamId ? r.awayTeamId : r.homeTeamId;
      }
    }
  };

  for (const bs of BRACKET) {
    const homeTeamId = teamFor(bs.home, bs.slot);
    const awayTeamId = teamFor(bs.away, bs.slot);
    const s = getScore(bs.slot);
    let winnerTeamId: number | null = null;
    if (homeTeamId != null && awayTeamId != null && s.home != null && s.away != null) {
      if (s.home > s.away) winnerTeamId = homeTeamId;
      else if (s.away > s.home) winnerTeamId = awayTeamId;
      else winnerTeamId = s.pen === homeTeamId || s.pen === awayTeamId ? s.pen : null;
    }
    winners[bs.slot] = winnerTeamId;
    out[bs.slot] = { slot: bs.slot, round: bs.round, homeTeamId, awayTeamId, winnerTeamId };
  }
  return out;
}

/** Conjunto de ganadores por ronda, a partir de un cuadro resuelto. */
export function winnersByRound(
  resolved: Record<string, ResolvedSlot>
): Record<string, Set<number>> {
  const map: Record<string, Set<number>> = {};
  for (const res of Object.values(resolved)) {
    if (res.winnerTeamId == null) continue;
    (map[res.round] ??= new Set()).add(res.winnerTeamId);
  }
  return map;
}

export { GROUPS };

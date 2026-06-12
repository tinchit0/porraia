import { prisma } from "@/lib/db";
import { cached } from "@/lib/cache";
import { POINTS } from "@/lib/scoring";
import { ROUND_ORDER } from "@/lib/bracket";

const GROUP_MATCH_COUNT = 72; // 12 groups × 6 matches
const BRACKET_SLOT_COUNT = 32; // 16 R32 + 8 R16 + 4 QF + 2 SF + 1 F + 1 THIRD
const TOTAL_COUNT = GROUP_MATCH_COUNT + BRACKET_SLOT_COUNT;

export type StandingRow = {
  userId: string;
  name: string;
  total: number;
  matchPoints: number;
  bracketPoints: number;
  bracketHits: number[]; // aciertos por ronda: R32/R16/QF/SF/F
  exact: number;   // 🎯 marcador exacto (3 pts)
  diff: number;    // 🔥 diferencia de goles (2 pts)
  results: number; // ✅ resultado 1X2 (1 pt)
  miss: number;    // ❌ fallos en partidos ya jugados
  completed: { filled: number; total: number };
};

/**
 * Clasificación general. Es idéntica para todos los usuarios, así que la
 * cacheamos en memoria: solo se recalcula cuando una server action invalida el
 * tag "standings" (admin guarda resultados, alguien edita su porra, nuevo
 * registro). El TTL de 60s es solo un colchón de seguridad.
 */
export function getStandings(): Promise<StandingRow[]> {
  return cached("standings", 60_000, computeStandings);
}

async function computeStandings(): Promise<StandingRow[]> {
  const [users, playedMatchIds] = await Promise.all([
    prisma.user.findMany({
      where: { role: { not: "ADMIN" } },
      include: { predictions: true, bracketPicks: true },
    }),
    prisma.match.findMany({
      where: { stage: "GROUP", homeScore: { not: null } },
      select: { id: true },
    }).then((ms) => new Set(ms.map((m) => m.id))),
  ]);

  const rows: StandingRow[] = users.map((u) => {
    const matchPoints = u.predictions.reduce((s, p) => s + p.points, 0);
    const bracketPoints = u.bracketPicks.reduce((s, p) => s + p.points, 0);
    const bracketHits = ROUND_ORDER.map(
      (round) => u.bracketPicks.filter((p) => p.slot.startsWith(round + "-") && p.points > 0).length
    );
    const exact   = u.predictions.filter((p) => p.points === POINTS.EXACT).length;
    const diff    = u.predictions.filter((p) => p.points === POINTS.DIFF).length;
    const results = u.predictions.filter((p) => p.points === POINTS.RESULT).length;
    const miss    = u.predictions.filter(
      (p) => p.points === 0 && playedMatchIds.has(p.matchId)
    ).length;
    const completed = {
      filled: u.predictions.length + u.bracketPicks.length,
      total: TOTAL_COUNT,
    };
    return {
      userId: u.id,
      name: u.name,
      total: matchPoints + bracketPoints,
      matchPoints,
      bracketPoints,
      bracketHits,
      exact,
      diff,
      results,
      miss,
      completed,
    };
  });

  rows.sort(
    (a, b) =>
      b.total - a.total ||
      b.exact - a.exact ||
      b.diff - a.diff ||
      b.results - a.results ||
      a.name.localeCompare(b.name)
  );

  return rows;
}

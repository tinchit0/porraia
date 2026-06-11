import { prisma } from "@/lib/db";
import { POINTS } from "@/lib/scoring";

const GROUP_MATCH_COUNT = 72; // 12 groups × 6 matches
const FINAL_SLOT = "F-104";

export type StandingRow = {
  userId: string;
  name: string;
  total: number;
  matchPoints: number;
  bracketPoints: number;
  exact: number; // marcadores exactos
  results: number; // aciertos 1X2
  completed: boolean; // todos los grupos + campeón elegido
};

/** Calcula la clasificación general a partir de los puntos cacheados. */
export async function getStandings(): Promise<StandingRow[]> {
  const users = await prisma.user.findMany({
    where: { role: { not: "ADMIN" } },
    include: { predictions: true, bracketPicks: true },
  });

  const rows: StandingRow[] = users.map((u) => {
    const matchPoints = u.predictions.reduce((s, p) => s + p.points, 0);
    const bracketPoints = u.bracketPicks.reduce((s, p) => s + p.points, 0);
    const exact = u.predictions.filter((p) => p.points === POINTS.EXACT).length;
    const results = u.predictions.filter((p) => p.points === POINTS.RESULT).length;
    const completed =
      u.predictions.length >= GROUP_MATCH_COUNT &&
      u.bracketPicks.some((p) => p.slot === FINAL_SLOT && p.winnerTeamId != null);
    return {
      userId: u.id,
      name: u.name,
      total: matchPoints + bracketPoints,
      matchPoints,
      bracketPoints,
      exact,
      results,
      completed,
    };
  });

  rows.sort(
    (a, b) =>
      b.total - a.total ||
      b.exact - a.exact ||
      b.results - a.results ||
      a.name.localeCompare(b.name)
  );

  return rows;
}

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { PorraEditor, type EditorData, type TeamLite } from "@/components/PorraEditor";

export const dynamic = "force-dynamic";

export default async function PorraPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/porra");

  const [groups, preds, picks, knockoutMatches] = await Promise.all([
    prisma.group.findMany({
      orderBy: { name: "asc" },
      include: {
        teams: { orderBy: { id: "asc" }, select: { id: true, name: true, flag: true } },
        matches: {
          where: { stage: "GROUP" },
          orderBy: [{ matchday: "asc" }, { kickoff: "asc" }],
          select: { id: true, matchday: true, homeTeamId: true, awayTeamId: true, kickoff: true },
        },
      },
    }),
    prisma.prediction.findMany({ where: { userId: user.id } }),
    prisma.bracketPick.findMany({ where: { userId: user.id } }),
    prisma.match.findMany({
      where: { stage: { in: ["R32", "R16", "QF", "SF", "FINAL", "THIRD"] } },
      select: { stage: true, kickoff: true },
      orderBy: { kickoff: "asc" },
    }),
  ]);

  const teamsById: Record<number, TeamLite> = {};
  for (const g of groups)
    for (const t of g.teams) teamsById[t.id] = { id: t.id, name: t.name, flag: t.flag };

  const stageToRound: Record<string, string> = { R32: "R32", R16: "R16", QF: "QF", SF: "SF", FINAL: "F", THIRD: "THIRD" };
  const roundDeadlines: Record<string, string> = {};
  for (const m of knockoutMatches) {
    const round = stageToRound[m.stage];
    if (round && !(round in roundDeadlines)) roundDeadlines[round] = m.kickoff.toISOString();
  }

  const data: EditorData = {
    groups: groups.map((g) => ({
      name: g.name,
      teams: g.teams.map((t) => ({ id: t.id, name: t.name, flag: t.flag })),
      matches: g.matches.map((m) => ({
        id: m.id,
        matchday: m.matchday ?? 1,
        homeId: m.homeTeamId ?? 0,
        awayId: m.awayTeamId ?? 0,
        kickoff: m.kickoff.toISOString(),
      })),
    })),
    teamsById,
    predictions: Object.fromEntries(
      preds.map((p) => [p.matchId, { home: p.homeScore, away: p.awayScore }])
    ),
    bracketPicks: Object.fromEntries(
      picks.map((p) => [p.slot, { home: p.homeScore, away: p.awayScore, winnerTeamId: p.winnerTeamId }])
    ),
    roundDeadlines,
  };

  return (
    <div>
      <h1 className="mb-1 text-3xl font-extrabold">Mi porra</h1>
      <p className="mb-6 text-muted">
        Marcadores de la fase de grupos y cuadro de eliminatorias.
      </p>
      <PorraEditor data={data} />
    </div>
  );
}

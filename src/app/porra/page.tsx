import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getLockAt, isLocked } from "@/lib/lock";
import { Countdown } from "@/components/Countdown";
import { PorraEditor, type EditorData, type TeamLite } from "@/components/PorraEditor";

export const dynamic = "force-dynamic";

export default async function PorraPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/porra");

  const [groups, preds, picks, lockAt, locked] = await Promise.all([
    prisma.group.findMany({
      orderBy: { name: "asc" },
      include: {
        teams: { orderBy: { id: "asc" }, select: { id: true, name: true, flag: true } },
        matches: {
          where: { stage: "GROUP" },
          orderBy: [{ matchday: "asc" }, { kickoff: "asc" }],
          select: { id: true, matchday: true, homeTeamId: true, awayTeamId: true },
        },
      },
    }),
    prisma.prediction.findMany({ where: { userId: user.id } }),
    prisma.bracketPick.findMany({ where: { userId: user.id } }),
    getLockAt(),
    isLocked(),
  ]);

  const teamsById: Record<number, TeamLite> = {};
  for (const g of groups)
    for (const t of g.teams) teamsById[t.id] = { id: t.id, name: t.name, flag: t.flag };

  const data: EditorData = {
    groups: groups.map((g) => ({
      name: g.name,
      teams: g.teams.map((t) => ({ id: t.id, name: t.name, flag: t.flag })),
      matches: g.matches.map((m) => ({
        id: m.id,
        matchday: m.matchday ?? 1,
        homeId: m.homeTeamId ?? 0,
        awayId: m.awayTeamId ?? 0,
      })),
    })),
    teamsById,
    predictions: Object.fromEntries(
      preds.map((p) => [p.matchId, { home: p.homeScore, away: p.awayScore }])
    ),
    bracketPicks: Object.fromEntries(
      picks.map((p) => [p.slot, { home: p.homeScore, away: p.awayScore }])
    ),
    locked,
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold">Mi porra</h1>
          <p className="mt-1 text-muted">
            Marcadores de la fase de grupos y cuadro de eliminatorias.
          </p>
        </div>
        <Countdown lockAtISO={lockAt.toISOString()} />
      </div>

      {locked ? (
        <p className="mb-6 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-red-300">
          🔒 El Mundial ya ha comenzado: tu porra está bloqueada y no se puede editar.
        </p>
      ) : (
        <p className="mb-6 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
          Puedes editar tu porra cuantas veces quieras hasta el pitido inicial. ¡No olvides
          guardar!
        </p>
      )}

      <PorraEditor data={data} />
    </div>
  );
}

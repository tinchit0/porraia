import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import {
  GroupResultsForm,
  type AdminMatch,
  type AdminTeam,
} from "@/components/AdminForms";
import { AdminBracket } from "@/components/AdminBracket";
import { getRealStandingsInput } from "@/lib/bracket-server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/admin");
  if (user.role !== "ADMIN") redirect("/");

  const [groupMatches, teams, userCount, realStandings, realKo] =
    await Promise.all([
      prisma.match.findMany({
        where: { stage: "GROUP" },
        orderBy: [{ groupId: "asc" }, { matchday: "asc" }, { kickoff: "asc" }],
        include: { homeTeam: true, awayTeam: true, group: true },
      }),
      prisma.team.findMany({ orderBy: [{ groupId: "asc" }, { name: "asc" }] }),
      prisma.user.count(),
      getRealStandingsInput(),
      prisma.realKnockout.findMany(),
    ]);

  const matches: AdminMatch[] = groupMatches.map((m) => ({
    id: m.id,
    group: m.group?.name ?? "?",
    matchday: m.matchday ?? 1,
    home: { name: m.homeTeam?.name ?? "?", flag: m.homeTeam?.flag ?? "" },
    away: { name: m.awayTeam?.name ?? "?", flag: m.awayTeam?.flag ?? "" },
    homeScore: m.homeScore,
    awayScore: m.awayScore,
  }));

  const teamList: AdminTeam[] = teams.map((t) => ({
    id: t.id,
    name: t.name,
    flag: t.flag,
  }));

  const teamsById: Record<number, AdminTeam> = {};
  for (const t of teamList) teamsById[t.id] = t;

  const realPicks = Object.fromEntries(
    realKo.map((k) => [
      k.slot,
      { home: k.homeScore, away: k.awayScore, pen: k.winnerTeamId },
    ])
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold">Panel de administración</h1>
        <p className="mt-1 text-muted">
          {userCount} participante{userCount === 1 ? "" : "s"} · introduce los resultados
          para recalcular la clasificación.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-xl font-bold">⚽ Resultados fase de grupos</h2>
        <GroupResultsForm matches={matches} />
      </section>

      <section>
        <h2 className="mb-1 text-xl font-bold">🏟️ Resultados del cuadro de eliminatorias</h2>
        <p className="mb-3 text-sm text-muted">
          Los cruces se calculan con la clasificación real de los grupos. Mete cada marcador
          (y el ganador de penaltis si hay empate) para puntuar los cuadros de los participantes.
        </p>
        <AdminBracket
          standingsByGroup={realStandings.standingsByGroup}
          thirds={realStandings.thirds}
          teamsById={teamsById}
          realPicks={realPicks}
        />
      </section>

    </div>
  );
}

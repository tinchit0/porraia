import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { GoalMap, type TeamGoalData } from "@/components/GoalMap";

export const dynamic = "force-dynamic";

export default async function MapaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/mapa");

  const [predictions, teams] = await Promise.all([
    prisma.prediction.findMany({
      where: { match: { stage: "GROUP" } },
      select: {
        homeScore: true,
        awayScore: true,
        match: { select: { homeTeamId: true, awayTeamId: true } },
      },
    }),
    prisma.team.findMany({
      select: { id: true, code: true, name: true, flag: true },
    }),
  ]);

  // Aggregate: per-prediction goals per team → average
  const agg: Record<number, { sum: number; count: number }> = {};
  for (const p of predictions) {
    const { homeTeamId, awayTeamId } = p.match;
    if (homeTeamId != null) {
      agg[homeTeamId] ??= { sum: 0, count: 0 };
      agg[homeTeamId].sum += p.homeScore;
      agg[homeTeamId].count++;
    }
    if (awayTeamId != null) {
      agg[awayTeamId] ??= { sum: 0, count: 0 };
      agg[awayTeamId].sum += p.awayScore;
      agg[awayTeamId].count++;
    }
  }

  const teamData: TeamGoalData[] = teams
    .map((t) => ({
      code: t.code,
      name: t.name,
      flag: t.flag,
      avgGoals: agg[t.id] ? agg[t.id].sum / agg[t.id].count : 0,
      predCount: agg[t.id]?.count ?? 0,
    }))
    .sort((a, b) => b.avgGoals - a.avgGoals);

  const totalPreds = new Set(
    predictions.map((p) => p.match.homeTeamId?.toString() ?? "")
  ).size;

  return (
    <div>
      <h1 className="text-3xl font-extrabold">Mapa de goles</h1>
      <p className="mt-1 text-muted">
        Media de goles pronosticados por selección en fase de grupos, según todas las porras.
        {predictions.length > 0 && (
          <span className="ml-1">({predictions.length} predicciones)</span>
        )}
      </p>

      <div className="mt-6">
        <GoalMap teams={teamData} />
      </div>

      {/* Ranking table */}
      <div className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Ranking por goles pronosticados</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {teamData
            .filter((t) => t.predCount > 0)
            .map((t, i) => (
              <div
                key={t.code}
                className="card flex items-center gap-3 p-3"
              >
                <span className="w-5 text-right text-xs text-muted">{i + 1}</span>
                <span className="text-xl">{t.flag}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.name}</div>
                  <div className="text-xs text-muted">{t.avgGoals.toFixed(2)} goles/partido</div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

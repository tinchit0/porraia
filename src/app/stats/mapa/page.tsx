import { getMapData, type StatsView } from "@/lib/stats";
import { GoalMap } from "@/components/GoalMap";
import { ViewToggle } from "@/components/ViewToggle";

export const dynamic = "force-dynamic";

export default async function StatsMapaPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: v } = await searchParams;
  const view: StatsView = v === "real" ? "real" : "pred";
  const { teamData, count } = await getMapData(view);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold">Mapa de goles</h2>
        <ViewToggle base="/stats/mapa" current={view} />
      </div>

      <p className="mt-2 text-muted">
        {view === "pred" ? (
          <>
            Media de goles pronosticados por selección en fase de grupos, según todas las porras.
            {count > 0 && <span className="ml-1">({count} predicciones)</span>}
          </>
        ) : (
          <>
            Media de goles reales por selección en fase de grupos, según los partidos jugados.
            {count > 0 && <span className="ml-1">({count} partidos)</span>}
          </>
        )}
      </p>

      <div className="mt-6">
        <GoalMap teams={teamData} />
      </div>

      {/* Ranking table */}
      <div className="mt-8">
        <h3 className="mb-3 text-lg font-bold">
          Ranking por goles {view === "pred" ? "pronosticados" : "reales"}
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {teamData
            .filter((t) => t.predCount > 0)
            .map((t, i) => (
              <div key={t.code} className="card flex items-center gap-3 p-3">
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

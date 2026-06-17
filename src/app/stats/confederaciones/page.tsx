import { getConfederationStats, type StatsView } from "@/lib/stats";
import { ConfederationChart } from "@/components/ConfederationChart";
import { ViewToggle } from "@/components/ViewToggle";
import { CONFEDERATIONS, CONFEDERATION_LABEL } from "@/lib/confederations";

export const dynamic = "force-dynamic";

export default async function StatsConfederacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: v } = await searchParams;
  const view: StatsView = v === "real" ? "real" : "pred";
  const data = await getConfederationStats(view);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold">Victorias por confederación</h2>
        <ViewToggle base="/stats/confederaciones" current={view} />
      </div>

      <p className="mt-2 text-muted">
        Victorias, empates y derrotas por confederación (grupos y eliminatorias),{" "}
        {view === "pred"
          ? "según los marcadores pronosticados en todas las porras."
          : "según los resultados reales hasta el momento."}
      </p>

      <div className="mt-6">
        <ConfederationChart data={data} />
      </div>

      {/* Glosario de confederaciones */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted sm:grid-cols-3">
        {CONFEDERATIONS.map((c) => (
          <div key={c}>
            <span className="font-semibold text-foreground">{c}</span> ·{" "}
            {CONFEDERATION_LABEL[c].replace(`${c} `, "").replace(/[()]/g, "")}
          </div>
        ))}
      </div>
    </div>
  );
}

import { getCurrentUser } from "@/lib/session";
import { getRankEvolution } from "@/lib/stats";
import { RankEvolutionChart } from "@/components/RankEvolutionChart";

export const dynamic = "force-dynamic";

export default async function StatsRankingPage() {
  const user = await getCurrentUser();
  const data = await getRankEvolution();

  return (
    <div>
      <h2 className="text-2xl font-bold">Evolución del ranking</h2>
      <p className="mt-2 text-muted">
        Posición de cada participante en la clasificación, partido a partido (orden
        cronológico). Tu línea aparece resaltada; pulsa un nombre para ocultarlo.
      </p>

      <div className="mt-6">
        <RankEvolutionChart data={data} currentUserId={user?.id ?? ""} />
      </div>
    </div>
  );
}

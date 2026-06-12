import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getStandings } from "@/lib/standings";
import { StandingsTable } from "@/components/StandingsTable";

export const dynamic = "force-dynamic";

export default async function ClasificacionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/clasificacion");

  const rows = await getStandings();

  return (
    <div>
      <h1 className="text-3xl font-extrabold">Clasificación general</h1>
      <p className="mt-1 text-muted">
        Puntos acumulados de toda la porra. Desempate por marcadores exactos.
      </p>

      <StandingsTable rows={rows} userId={user.id} />
    </div>
  );
}

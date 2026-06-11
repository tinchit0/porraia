import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getStandings } from "@/lib/standings";

export const dynamic = "force-dynamic";

const MEDALS = ["🥇", "🥈", "🥉"];

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

      {rows.length === 0 ? (
        <p className="mt-8 text-muted">Aún no hay participantes.</p>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Participante</th>
                <th className="px-4 py-3 text-center" title="Partidos de fase de grupos completados">Completado</th>
                <th className="px-4 py-3 text-center cursor-help" title="Marcador exacto (3 pts)">🎯</th>
                <th className="px-4 py-3 text-center cursor-help" title="Diferencia de goles correcta (2 pts)">🔥</th>
                <th className="px-4 py-3 text-center cursor-help" title="Resultado 1X2 correcto (1 pt)">✅</th>
                <th className="px-4 py-3 text-center cursor-help" title="Fallos en partidos ya jugados">❌</th>
                <th className="px-4 py-3 text-center cursor-help" title="Equipos acertados por ronda: 1/16 · 1/8 · 1/4 · 1/2 · Final">Cuadro</th>
                <th className="px-4 py-3 text-right">Puntos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const isMe = r.userId === user.id;
                const { filled, total } = r.completed;
                const completedColor =
                  filled === 0
                    ? "text-red-400"
                    : filled >= total
                    ? "text-green-400"
                    : "text-yellow-400";
                return (
                  <tr
                    key={r.userId}
                    className={`border-b border-border/60 last:border-0 ${
                      isMe ? "bg-primary/10" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold">
                      {MEDALS[i] ?? i + 1}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {r.name}
                      {isMe && (
                        <span className="badge ml-2 bg-primary/20 text-green-300">
                          tú
                        </span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-center tabular-nums font-medium ${completedColor}`}>
                      {filled}/{total}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums text-muted">{r.exact}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-muted">{r.diff}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-muted">{r.results}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-muted">{r.miss}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-muted">
                      {r.bracketHits.join("/")}
                    </td>
                    <td className="px-4 py-3 text-right text-lg font-extrabold text-accent">
                      {r.total}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

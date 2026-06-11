import Link from "next/link";
import { POINTS, KNOCKOUT_POINTS } from "@/lib/scoring";

export const metadata = { title: "Normas · PORRAIA" };

export default function NormasPage() {
  return (
    <div className="prose-invert max-w-3xl">
      <h1 className="text-3xl font-extrabold">Normas de la porra</h1>
      <p className="mt-2 text-muted">
        Todo lo que necesitas saber para jugar. ¡Que gane el mejor!
      </p>

      <section className="card mt-6 space-y-3 p-6">
        <h2 className="text-xl font-bold">📝 Cómo se juega</h2>
        <ul className="list-disc space-y-2 pl-5 text-muted">
          <li>
            Regístrate con tu correo y rellena tu porra desde{" "}
            <Link href="/porra" className="text-accent hover:underline">
              Mi porra
            </Link>
            .
          </li>
          <li>
            Predice el <strong className="text-foreground">marcador exacto</strong> de los 72
            partidos de la fase de grupos.
          </li>
          <li>
            La <strong className="text-foreground">clasificación de cada grupo</strong> según tus
            marcadores arma tu <strong className="text-foreground">cuadro de eliminatorias</strong>:
            rellena cada cruce (si hay empate, eliges quién pasa por penaltis) hasta la final.
          </li>
          <li>
            Puedes editar tu porra mientras los partidos no hayan empezado:{" "}
            <strong className="text-foreground">cada partido de grupos se bloquea en su pitido inicial</strong>,
            y cada ronda de eliminatorias se bloquea cuando arranca su primer partido.
          </li>
        </ul>
      </section>

      <section className="card mt-5 space-y-4 p-6">
        <h2 className="text-xl font-bold">🎯 Puntuación</h2>

        <div>
          <h3 className="font-semibold">Partidos (grupos y eliminatorias)</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <div className="flex items-center justify-between rounded-lg bg-surface-2 px-4 py-3">
              <span>Marcador exacto</span>
              <span className="badge bg-primary text-primary-fg">+{POINTS.EXACT} pts</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-surface-2 px-4 py-3">
              <span>Diferencia de goles</span>
              <span className="badge bg-accent/30 text-accent">+{POINTS.DIFF} pts</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-surface-2 px-4 py-3">
              <span>Acertar 1·X·2</span>
              <span className="badge bg-accent/30 text-accent">+{POINTS.RESULT} pt</span>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted">
            Las tres categorías son excluyentes: se aplica la mayor. En eliminatorias, el marcador solo
            puntúa si los dos rivales del partido coinciden con tu predicción.
          </p>
        </div>

        <div>
          <h3 className="font-semibold">Cuadro de eliminatorias</h3>
          <p className="mb-2 text-sm text-muted">
            Por cada equipo que predices que supera una ronda y de verdad la supera. Cuanto más
            lejos, más puntos.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="flex items-center justify-between rounded-lg bg-surface-2 px-4 py-3">
              <span>Pasar a octavos</span>
              <span className="badge bg-accent/30 text-accent">+{KNOCKOUT_POINTS.R32}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-surface-2 px-4 py-3">
              <span>Pasar a cuartos</span>
              <span className="badge bg-accent/30 text-accent">+{KNOCKOUT_POINTS.R16}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-surface-2 px-4 py-3">
              <span>Pasar a semis</span>
              <span className="badge bg-accent/30 text-accent">+{KNOCKOUT_POINTS.QF}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-surface-2 px-4 py-3">
              <span>🥈 Llegar a la final</span>
              <span className="badge bg-primary text-primary-fg">+{KNOCKOUT_POINTS.SF}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-surface-2 px-4 py-3">
              <span>🏆 Campeón</span>
              <span className="badge bg-primary text-primary-fg">+{KNOCKOUT_POINTS.F}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-surface-2 px-4 py-3">
              <span>🥉 3er puesto</span>
              <span className="badge bg-accent/30 text-accent">+{KNOCKOUT_POINTS.THIRD}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="card mt-5 space-y-2 p-6">
        <h2 className="text-xl font-bold">🏅 Clasificación y desempates</h2>
        <p className="text-muted">
          Gana quien sume más puntos al final del torneo. En caso de empate, se ordena por
          número de <strong className="text-foreground">marcadores exactos</strong> y, si
          persiste, por número de aciertos de resultado (1·X·2).
        </p>
      </section>
    </div>
  );
}

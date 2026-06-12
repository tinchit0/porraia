import Link from "next/link";
import { prisma } from "@/lib/db";
import { cached } from "@/lib/cache";
import { getCurrentUser } from "@/lib/session";
import { getLockAt } from "@/lib/lock";
import { getStandings } from "@/lib/standings";
import { Countdown } from "@/components/Countdown";

/** Próximos 5 partidos de grupos — iguales para todos, así que se cachean. */
function getUpcomingGroupMatches() {
  return cached("matches:upcoming", 300_000, () =>
    prisma.match.findMany({
      where: { stage: "GROUP" },
      orderBy: { kickoff: "asc" },
      take: 5,
      include: { homeTeam: true, awayTeam: true, group: true },
    }),
  );
}

export const dynamic = "force-dynamic";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function Home() {
  const user = await getCurrentUser();
  const lockAt = await getLockAt();

  if (!user) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <span className="text-6xl">⚽🏆</span>
        <h1 className="mt-6 text-4xl font-extrabold sm:text-5xl">
          PORR<span className="text-accent">AIA</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">
          Predice los marcadores de la fase de grupos, apuesta por el campeón y el pichichi,
          y compite con tus amigos por la gloria.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/registro" className="btn-primary px-6 text-base">
            Crear cuenta
          </Link>
          <Link href="/login" className="btn-ghost px-6 text-base">
            Entrar
          </Link>
        </div>
        <div className="mt-10">
          <p className="mb-2 text-sm text-muted">El plazo para rellenar la porra cierra en:</p>
          <Countdown lockAtISO={lockAt.toISOString()} />
        </div>
      </div>
    );
  }

  const [standings, nextMatches, myBet] = await Promise.all([
    getStandings(),
    getUpcomingGroupMatches(),
    prisma.prediction.count({ where: { userId: user.id } }),
  ]);

  const myRow = standings.find((r) => r.userId === user.id);
  const myRank = standings.findIndex((r) => r.userId === user.id) + 1;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold">¡Hola, {user.name}! 👋</h1>
          <p className="mt-1 text-muted">Bienvenido a PORRAIA.</p>
        </div>
        <Countdown lockAtISO={lockAt.toISOString()} />
      </div>

      {/* Tarjetas resumen */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-muted">Tu posición</p>
          <p className="mt-1 text-3xl font-extrabold text-accent">
            {myRank > 0 ? `#${myRank}` : "—"}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-muted">Tus puntos</p>
          <p className="mt-1 text-3xl font-extrabold">{myRow?.total ?? 0}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-muted">Pronósticos rellenados</p>
          <p className="mt-1 text-3xl font-extrabold">{myBet} / 72</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/porra" className="btn-primary">
          Editar mi porra
        </Link>
        <Link href="/clasificacion" className="btn-ghost">
          Ver clasificación
        </Link>
        <Link href="/normas" className="btn-ghost">
          Normas
        </Link>
      </div>

      {/* Próximos partidos */}
      <section>
        <h2 className="mb-3 text-xl font-bold">Próximos partidos</h2>
        <div className="card divide-y divide-border">
          {nextMatches.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="w-28 shrink-0 text-xs text-muted">
                Grupo {m.group?.name}
                <br />
                {fmtDate(m.kickoff)}
              </span>
              <span className="flex flex-1 items-center justify-end gap-2 text-right font-medium">
                {m.homeTeam?.name} {m.homeTeam?.flag}
              </span>
              <span className="text-muted">vs</span>
              <span className="flex flex-1 items-center gap-2 font-medium">
                {m.awayTeam?.flag} {m.awayTeam?.name}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

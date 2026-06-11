import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { scoreMatchPrediction } from "@/lib/scoring";
import type { Stage } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

type RoundDef = { key: string; label: string; stage: Stage; matchday?: number };

const ROUNDS: RoundDef[] = [
  { key: "g1", label: "Jornada 1", stage: "GROUP", matchday: 1 },
  { key: "g2", label: "Jornada 2", stage: "GROUP", matchday: 2 },
  { key: "g3", label: "Jornada 3", stage: "GROUP", matchday: 3 },
];

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function JornadaPage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/jornada");

  const { r } = await searchParams;
  const round = ROUNDS.find((x) => x.key === r) ?? ROUNDS[0];

  const matches = await prisma.match.findMany({
    where: { stage: round.stage, ...(round.matchday ? { matchday: round.matchday } : {}) },
    orderBy: [{ kickoff: "asc" }],
    include: { homeTeam: true, awayTeam: true, group: true },
  });

  const preds = await prisma.prediction.findMany({
    where: { userId: user.id, matchId: { in: matches.map((m) => m.id) } },
  });
  const predByMatch = new Map(preds.map((p) => [p.matchId, p]));

  const roundPoints = matches.reduce((s, m) => {
    const p = predByMatch.get(m.id);
    return s + (p ? scoreMatchPrediction(p, m) : 0);
  }, 0);

  return (
    <div>
      <h1 className="text-3xl font-extrabold">Jornada</h1>
      <p className="mt-1 text-muted">
        Tus predicciones frente a los resultados reales y los puntos que llevas.
      </p>

      {/* Pestañas de ronda */}
      <div className="mt-5 flex flex-wrap gap-2">
        {ROUNDS.map((x) => (
          <Link
            key={x.key}
            href={`/jornada?r=${x.key}`}
            className={`chip transition ${
              x.key === round.key
                ? "border-primary bg-primary/20 text-green-200"
                : "text-muted hover:text-foreground"
            }`}
          >
            {x.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">{round.label}</h2>
        {round.stage === "GROUP" && (
          <span className="badge bg-accent/20 text-accent">
            {roundPoints} pts en esta jornada
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {matches.map((m) => {
          const played = m.homeScore != null && m.awayScore != null;
          const pred = predByMatch.get(m.id);
          const pts = pred ? scoreMatchPrediction(pred, m) : 0;
          return (
            <div key={m.id} className="card flex items-center gap-3 p-3 sm:p-4">
              <div className="w-20 shrink-0 text-xs text-muted">
                {m.group ? `Grupo ${m.group.name}` : m.label}
                <div>{fmtDate(m.kickoff)}</div>
              </div>

              <div className="flex flex-1 items-center justify-center gap-3">
                <span className="flex flex-1 items-center justify-end gap-2 text-right text-sm font-medium">
                  <span className="truncate">{m.homeTeam?.name ?? "Por definir"}</span>
                  <span className="text-lg">{m.homeTeam?.flag}</span>
                </span>
                <span className="min-w-16 text-center text-lg font-extrabold tabular-nums">
                  {played ? `${m.homeScore} - ${m.awayScore}` : "— : —"}
                </span>
                <span className="flex flex-1 items-center gap-2 text-sm font-medium">
                  <span className="text-lg">{m.awayTeam?.flag}</span>
                  <span className="truncate">{m.awayTeam?.name ?? "Por definir"}</span>
                </span>
              </div>

              <div className="w-24 shrink-0 text-right text-xs">
                {round.stage === "GROUP" ? (
                  pred ? (
                    <>
                      <div className="text-muted">
                        Tú: {pred.homeScore}-{pred.awayScore}
                      </div>
                      {played && (
                        <span
                          className={`badge mt-1 ${
                            pts === 3
                              ? "bg-primary text-primary-fg"
                              : pts === 1
                                ? "bg-accent/30 text-accent"
                                : "bg-surface-2 text-muted"
                          }`}
                        >
                          +{pts}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted">Sin pronóstico</span>
                  )
                ) : (
                  <span className="text-muted">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

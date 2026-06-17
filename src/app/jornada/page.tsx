import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { cached } from "@/lib/cache";
import { getCurrentUser } from "@/lib/session";
import { scoreMatchPrediction, KNOCKOUT_POINTS } from "@/lib/scoring";
import { JornadaMatchCard, type ParticipantPred } from "@/components/JornadaMatchCard";
import { KnockoutJornadaCard, type KnockoutPickInfo, type KnockoutTeamSlot } from "@/components/KnockoutJornadaCard";
import { KickoffTime } from "@/components/KickoffTime";
import {
  BRACKET,
  ROUND_TAB_LABELS,
  ROUND_FULL_LABELS,
  ROUND_ORDER,
  slotRefLabel,
  type Round,
} from "@/lib/bracket";
import type { Stage } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

// DB stage "FINAL" → bracket round "F"
const DB_STAGE_TO_ROUND: Record<string, Round> = {
  R32: "R32", R16: "R16", QF: "QF", SF: "SF", FINAL: "F",
};

type GroupTab  = { kind: "group";   key: string; label: string; stage: "GROUP"; matchday: number };
type KoTab     = { kind: "ko";      key: string; label: string; dbStage: Stage;  round: Round };
type TabDef    = GroupTab | KoTab;

const TABS: TabDef[] = [
  { kind: "group", key: "g1", label: "Jornada 1", stage: "GROUP", matchday: 1 },
  { kind: "group", key: "g2", label: "Jornada 2", stage: "GROUP", matchday: 2 },
  { kind: "group", key: "g3", label: "Jornada 3", stage: "GROUP", matchday: 3 },
  { kind: "ko", key: "r32", label: ROUND_TAB_LABELS.R32, dbStage: "R32",   round: "R32" },
  { kind: "ko", key: "r16", label: ROUND_TAB_LABELS.R16, dbStage: "R16",   round: "R16" },
  { kind: "ko", key: "qf",  label: ROUND_TAB_LABELS.QF,  dbStage: "QF",    round: "QF"  },
  { kind: "ko", key: "sf",  label: ROUND_TAB_LABELS.SF,  dbStage: "SF",    round: "SF"  },
  { kind: "ko", key: "f", label: ROUND_TAB_LABELS.F, dbStage: "FINAL", round: "F" },
];

export default async function JornadaPage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/jornada");

  const { r } = await searchParams;
  const tab = TABS.find((t) => t.key === r) ?? TABS[0];

  // ─── Fase de grupos ───────────────────────────────────────────────────────
  if (tab.kind === "group") {
    // Datos globales (partidos + pronósticos ajenos ya visibles): iguales para
    // todos, se cachean. TTL corto (30s) porque la visibilidad depende del
    // pitido inicial de cada partido, no solo de mutaciones.
    const { matches, allPredsByMatch } = await cached(
      `jornada:g${tab.matchday}`,
      30_000,
      async () => {
        const matches = await prisma.match.findMany({
          where: { stage: "GROUP", matchday: tab.matchday },
          orderBy: [{ kickoff: "asc" }],
          include: { homeTeam: true, awayTeam: true, group: true },
        });

        const at = new Date();
        const lockedMatchIds = matches
          .filter((m) => m.kickoff <= at)
          .map((m) => m.id);

        // Solo los pronósticos de partidos YA bloqueados salen del servidor.
        const allPredsRaw =
          lockedMatchIds.length > 0
            ? await prisma.prediction.findMany({
                where: { matchId: { in: lockedMatchIds } },
                select: {
                  matchId: true,
                  homeScore: true,
                  awayScore: true,
                  user: { select: { name: true } },
                },
              })
            : [];

        const allPredsByMatch = new Map<number, ParticipantPred[]>();
        for (const p of allPredsRaw) {
          const arr = allPredsByMatch.get(p.matchId) ?? [];
          arr.push({ name: p.user.name, homeScore: p.homeScore, awayScore: p.awayScore });
          allPredsByMatch.set(p.matchId, arr);
        }

        return { matches, allPredsByMatch };
      },
    );

    const now = new Date();

    // Pronósticos del propio usuario: sin cachear (baratos y deben verse al instante).
    const preds = await prisma.prediction.findMany({
      where: { userId: user.id, matchId: { in: matches.map((m) => m.id) } },
    });
    const predByMatch = new Map(preds.map((p) => [p.matchId, p]));

    const roundPoints = matches.reduce((s, m) => {
      const p = predByMatch.get(m.id);
      return s + (p ? scoreMatchPrediction(p, m) : 0);
    }, 0);

    return (
      <JornadaLayout tab={tab} tabs={TABS} roundPoints={roundPoints} stage="group">
        <div className="mt-3 space-y-2">
          {matches.map((m) => {
            const played = m.homeScore != null && m.awayScore != null;
            const pred = predByMatch.get(m.id);
            const pts = pred ? scoreMatchPrediction(pred, m) : 0;
            const locked = m.kickoff <= now;
            const allPreds = allPredsByMatch.get(m.id) ?? [];
            return (
              <JornadaMatchCard
                key={m.id}
                locked={locked}
                allPreds={allPreds}
                realHome={m.homeScore ?? null}
                realAway={m.awayScore ?? null}
              >
                <div className="card flex items-center gap-3 p-3 sm:p-4">
                  <div className="w-20 shrink-0 text-xs text-muted">
                    {m.group ? `Grupo ${m.group.name}` : m.label}
                    <div>
                      <KickoffTime iso={m.kickoff.toISOString()} />
                    </div>
                    {locked && allPreds.length > 0 && (
                      <div className="mt-0.5 text-[10px] text-muted/60">
                        👥 {allPreds.length}
                      </div>
                    )}
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
                    {pred ? (
                      <>
                        <div className="text-muted">
                          Tú: {pred.homeScore}-{pred.awayScore}
                        </div>
                        {played && (
                          <span
                            className={`badge mt-1 ${
                              pts === 3
                                ? "bg-primary text-primary-fg"
                                : pts === 2
                                  ? "bg-lime-400/25 text-lime-300"
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
                    )}
                  </div>
                </div>
              </JornadaMatchCard>
            );
          })}
        </div>
      </JornadaLayout>
    );
  }

  // ─── Eliminatorias ────────────────────────────────────────────────────────
  const { dbStage, round } = tab;

  // Para el tab de Final incluimos también el partido por el 3er puesto (antes del final)
  const isFinalsTab = round === "F";
  const stages = isFinalsTab ? (["THIRD", "FINAL"] as Stage[]) : [dbStage];

  // Slots del bracket en el mismo orden que los matches (THIRD primero si aplica)
  const bracketSlots = isFinalsTab
    ? [...BRACKET.filter((b) => b.round === "THIRD"), ...BRACKET.filter((b) => b.round === "F")]
    : BRACKET.filter((b) => b.round === round);
  const slotNames = bracketSlots.map((b) => b.slot);

  // Datos globales (partidos + picks de todos): iguales para todos, se cachean.
  const { matches, picksBySlot, realWinnerBySlot } = await cached(
    `jornada:${tab.key}`,
    30_000,
    async () => {
      const [matches, allPicksRaw, realKo] = await Promise.all([
        prisma.match.findMany({
          where: { stage: { in: stages } },
          orderBy: { kickoff: "asc" }, // THIRD se juega antes que la Final
          include: { homeTeam: true, awayTeam: true },
        }),
        prisma.bracketPick.findMany({
          where: { slot: { in: slotNames } },
          include: { user: { select: { id: true, name: true } } },
        }),
        prisma.realKnockout.findMany({
          where: { slot: { in: slotNames } },
          select: { slot: true, winnerTeamId: true },
        }),
      ]);

      const picksBySlot = new Map<string, KnockoutPickInfo[]>();
      for (const p of allPicksRaw) {
        const arr = picksBySlot.get(p.slot) ?? [];
        if (p.homeScore == null || p.awayScore == null) continue;
        arr.push({
          userId: p.userId,
          userName: p.user.name,
          homeScore: p.homeScore,
          awayScore: p.awayScore,
          winnerTeamId: p.winnerTeamId,
          points: p.points,
        });
        picksBySlot.set(p.slot, arr);
      }

      // Ganador real por slot (penaltis incluidos vía RealKnockout.winnerTeamId).
      const realWinnerBySlot = new Map(realKo.map((k) => [k.slot, k.winnerTeamId]));

      return { matches, picksBySlot, realWinnerBySlot };
    },
  );

  const now = new Date();

  // Ganadores reales por ronda (mismo criterio que el servidor: un set por ronda).
  // Por marcador y, en caso de empate, por penaltis (RealKnockout.winnerTeamId).
  const realWinnersByRound = new Map<string, Set<number>>();
  matches.forEach((m, i) => {
    const bs = bracketSlots[i];
    if (!bs || m.homeScore == null || m.awayScore == null) return;
    const w =
      m.homeScore > m.awayScore
        ? m.homeTeam?.id ?? null
        : m.awayScore > m.homeScore
          ? m.awayTeam?.id ?? null
          : realWinnerBySlot.get(bs.slot) ?? null;
    if (w == null) return;
    let set = realWinnersByRound.get(bs.round);
    if (!set) {
      set = new Set();
      realWinnersByRound.set(bs.round, set);
    }
    set.add(w);
  });

  return (
    <JornadaLayout tab={tab} tabs={TABS} stage="ko">
      <div className="mt-3 space-y-2">
        {matches.map((m, i) => {
          const bs = bracketSlots[i];
          if (!bs) return null;

          const allPicksFull = picksBySlot.get(bs.slot) ?? [];
          const myPick = allPicksFull.find((p) => p.userId === user.id) ?? null;
          const locked = m.kickoff <= now;
          // Los picks ajenos solo salen del servidor cuando la ronda está
          // bloqueada (la tarjeta ya los ignora si no, pero así no viajan).
          const allPicks = locked ? allPicksFull : [];

          const homeTeam: KnockoutTeamSlot = m.homeTeam
            ? { id: m.homeTeam.id, name: m.homeTeam.name, flag: m.homeTeam.flag }
            : { id: null, name: slotRefLabel(bs.home), flag: null };

          const awayTeam: KnockoutTeamSlot = m.awayTeam
            ? { id: m.awayTeam.id, name: m.awayTeam.name, flag: m.awayTeam.flag }
            : { id: null, name: slotRefLabel(bs.away), flag: null };

          // Split de puntos de mi pick: avance (escalado por ronda) + resultado.
          // El avance puntúa si el equipo que dije clasifica en esa ronda (igual
          // que el servidor: set de ganadores por ronda, no por cruce concreto).
          const advancePts =
            myPick?.winnerTeamId != null && realWinnersByRound.get(bs.round)?.has(myPick.winnerTeamId)
              ? KNOCKOUT_POINTS[bs.round] ?? 0
              : 0;
          // El total cacheado (bracketPick.points) ya es avance + resultado.
          const resultPts = Math.max(0, (myPick?.points ?? 0) - advancePts);

          return (
            <KnockoutJornadaCard
              key={m.id}
              label={ROUND_FULL_LABELS[bs.round]}
              kickoffISO={m.kickoff.toISOString()}
              home={homeTeam}
              away={awayTeam}
              realHome={m.homeScore ?? null}
              realAway={m.awayScore ?? null}
              myPick={myPick}
              allPicks={allPicks}
              currentUserId={user.id}
              locked={locked}
              resultPts={resultPts}
              advancePts={advancePts}
            />
          );
        })}
      </div>
    </JornadaLayout>
  );
}

// ─── Layout compartido ────────────────────────────────────────────────────────
function JornadaLayout({
  tab,
  tabs,
  children,
  roundPoints,
  stage,
}: {
  tab: TabDef;
  tabs: TabDef[];
  children: React.ReactNode;
  roundPoints?: number;
  stage: "group" | "ko";
}) {
  return (
    <div>
      <h1 className="text-3xl font-extrabold">Jornada</h1>
      <p className="mt-1 text-muted">
        Tus predicciones frente a los resultados reales y los puntos que llevas.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/jornada?r=${t.key}`}
            className={`chip transition ${
              t.key === tab.key
                ? "border-primary bg-primary/20 text-green-200"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">
          {tab.kind === "group" ? tab.label : ROUND_FULL_LABELS[tab.round]}
        </h2>
        {stage === "group" && roundPoints != null && (
          <span className="badge bg-accent/20 text-accent">
            {roundPoints} pts en esta jornada
          </span>
        )}
      </div>

      {children}
    </div>
  );
}

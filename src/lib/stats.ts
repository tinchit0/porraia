import { prisma } from "@/lib/db";
import { cached } from "@/lib/cache";
import { POINTS } from "@/lib/scoring";
import {
  BRACKET,
  computeStandingsAndThirds,
  resolveWithScores,
  type Round,
  type SlotScore,
} from "@/lib/bracket";
import { loadGroupsForBracket, toStandingsInput } from "@/lib/bracket-server";
import {
  CODE_TO_CONFEDERATION,
  CONFEDERATIONS,
  type Confederation,
} from "@/lib/confederations";
import type { TeamGoalData } from "@/components/GoalMap";

export type StatsView = "real" | "pred";

// DB stage → bracket round (FINAL→F; el resto coinciden).
const DB_STAGE_TO_ROUND: Record<string, Round> = {
  R32: "R32", R16: "R16", QF: "QF", SF: "SF", FINAL: "F", THIRD: "THIRD",
};

/** Mapa matchId→slot para partidos de eliminatorias (zip posicional por ronda,
 *  igual criterio que src/app/jornada/page.tsx). */
function koSlotByMatchId(
  koMatches: { id: number; stage: string; kickoff: Date }[]
): Map<number, string> {
  const map = new Map<number, string>();
  const byStage = new Map<string, typeof koMatches>();
  for (const m of koMatches) {
    const arr = byStage.get(m.stage) ?? [];
    arr.push(m);
    byStage.set(m.stage, arr);
  }
  for (const [stage, ms] of byStage) {
    const round = DB_STAGE_TO_ROUND[stage];
    if (!round) continue;
    const slots = BRACKET.filter((b) => b.round === round); // orden natural del array
    [...ms]
      .sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime())
      .forEach((m, i) => {
        if (slots[i]) map.set(m.id, slots[i].slot);
      });
  }
  return map;
}

// ─── Mapa de goles ──────────────────────────────────────────────────────────

/** Media de goles por selección, según pronósticos (pred) o resultados reales. */
export function getMapData(view: StatsView) {
  return cached(`stats:mapa:${view}`, 60_000, () => computeMapData(view));
}

async function computeMapData(
  view: StatsView
): Promise<{ teamData: TeamGoalData[]; count: number }> {
  const teams = await prisma.team.findMany({
    select: { id: true, code: true, name: true, flag: true },
  });

  const agg: Record<number, { sum: number; count: number }> = {};
  const add = (teamId: number | null, goals: number) => {
    if (teamId == null) return;
    agg[teamId] ??= { sum: 0, count: 0 };
    agg[teamId].sum += goals;
    agg[teamId].count++;
  };

  let count = 0;
  if (view === "pred") {
    const predictions = await prisma.prediction.findMany({
      where: { match: { stage: "GROUP" } },
      select: {
        homeScore: true,
        awayScore: true,
        match: { select: { homeTeamId: true, awayTeamId: true } },
      },
    });
    for (const p of predictions) {
      add(p.match.homeTeamId, p.homeScore);
      add(p.match.awayTeamId, p.awayScore);
    }
    count = predictions.length;
  } else {
    const matches = await prisma.match.findMany({
      where: { stage: "GROUP", homeScore: { not: null }, awayScore: { not: null } },
      select: { homeScore: true, awayScore: true, homeTeamId: true, awayTeamId: true },
    });
    for (const m of matches) {
      add(m.homeTeamId, m.homeScore!);
      add(m.awayTeamId, m.awayScore!);
    }
    count = matches.length;
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

  return { teamData, count };
}

// ─── Confederaciones (V/E/D) ──────────────────────────────────────────────────

export type ConfederationRow = {
  conf: Confederation;
  win: number;
  draw: number;
  loss: number;
};

export function getConfederationStats(view: StatsView) {
  return cached(`stats:conf:${view}`, 60_000, () => computeConfederationStats(view));
}

async function computeConfederationStats(view: StatsView): Promise<ConfederationRow[]> {
  const teams = await prisma.team.findMany({ select: { id: true, code: true } });
  const confByTeam = new Map<number, Confederation>();
  for (const t of teams) {
    const conf = CODE_TO_CONFEDERATION[t.code];
    if (conf) confByTeam.set(t.id, conf);
  }

  // Acumuladores por confederación.
  const tally: Record<Confederation, { win: number; draw: number; loss: number }> =
    Object.fromEntries(CONFEDERATIONS.map((c) => [c, { win: 0, draw: 0, loss: 0 }])) as Record<
      Confederation,
      { win: number; draw: number; loss: number }
    >;

  // Suma un enfrentamiento (homeTeamId vs awayTeamId con marcador) a los tallies.
  // winnerId != null fuerza el ganador en caso de empate de marcador (KO real);
  // si es null, un empate cuenta como empate para ambos.
  const addMatch = (
    homeTeamId: number | null,
    awayTeamId: number | null,
    homeScore: number,
    awayScore: number,
    winnerId: number | null = null
  ) => {
    const hc = homeTeamId != null ? confByTeam.get(homeTeamId) : undefined;
    const ac = awayTeamId != null ? confByTeam.get(awayTeamId) : undefined;
    let homeRes: "win" | "draw" | "loss";
    let awayRes: "win" | "draw" | "loss";
    if (homeScore > awayScore) {
      homeRes = "win"; awayRes = "loss";
    } else if (awayScore > homeScore) {
      homeRes = "loss"; awayRes = "win";
    } else if (winnerId != null) {
      homeRes = winnerId === homeTeamId ? "win" : "loss";
      awayRes = winnerId === awayTeamId ? "win" : "loss";
    } else {
      homeRes = "draw"; awayRes = "draw";
    }
    if (hc) tally[hc][homeRes]++;
    if (ac) tally[ac][awayRes]++;
  };

  if (view === "real") {
    // Grupos: por marcador. KO: por marcador y, si empate, ganador de RealKnockout.
    const [groupMatches, koMatches, realKo] = await Promise.all([
      prisma.match.findMany({
        where: { stage: "GROUP", homeScore: { not: null }, awayScore: { not: null } },
        select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
      }),
      prisma.match.findMany({
        where: {
          stage: { in: ["R32", "R16", "QF", "SF", "THIRD", "FINAL"] },
          homeScore: { not: null },
          awayScore: { not: null },
        },
        select: { id: true, stage: true, kickoff: true, homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
      }),
      prisma.realKnockout.findMany({ select: { slot: true, winnerTeamId: true } }),
    ]);

    for (const m of groupMatches) {
      addMatch(m.homeTeamId, m.awayTeamId, m.homeScore!, m.awayScore!);
    }

    const slotByMatch = koSlotByMatchId(koMatches);
    const realWinnerBySlot = new Map(realKo.map((k) => [k.slot, k.winnerTeamId]));
    for (const m of koMatches) {
      const slot = slotByMatch.get(m.id);
      const winnerId = slot ? realWinnerBySlot.get(slot) ?? null : null;
      addMatch(m.homeTeamId, m.awayTeamId, m.homeScore!, m.awayScore!, winnerId);
    }
  } else {
    // Pronósticos agregados sobre todas las porras.
    // Grupos: cada Prediction. KO: cruce resuelto de cada usuario + marcador del pick.
    const groups = await loadGroupsForBracket();
    const groupsInput = toStandingsInput(groups);

    const [predictions, allPicks] = await Promise.all([
      prisma.prediction.findMany({
        where: { match: { stage: "GROUP" } },
        select: {
          homeScore: true,
          awayScore: true,
          match: { select: { homeTeamId: true, awayTeamId: true } },
        },
      }),
      prisma.bracketPick.findMany({
        select: { userId: true, slot: true, homeScore: true, awayScore: true, winnerTeamId: true },
      }),
    ]);

    for (const p of predictions) {
      addMatch(p.match.homeTeamId, p.match.awayTeamId, p.homeScore, p.awayScore);
    }

    // Agrupar picks por usuario para resolver su cuadro.
    const picksByUser = new Map<string, typeof allPicks>();
    for (const p of allPicks) {
      const arr = picksByUser.get(p.userId) ?? [];
      arr.push(p);
      picksByUser.set(p.userId, arr);
    }
    // Predicciones de grupos por usuario para resolver su clasificación de grupos.
    const userPreds = await prisma.prediction.findMany({
      where: { match: { stage: "GROUP" } },
      select: { userId: true, matchId: true, homeScore: true, awayScore: true },
    });
    const predsByUser = new Map<string, Map<number, { home: number; away: number }>>();
    for (const p of userPreds) {
      const mm = predsByUser.get(p.userId) ?? new Map();
      mm.set(p.matchId, { home: p.homeScore, away: p.awayScore });
      predsByUser.set(p.userId, mm);
    }

    for (const [userId, picks] of picksByUser) {
      const predByMatch = predsByUser.get(userId) ?? new Map();
      const { standingsByGroup, thirds } = computeStandingsAndThirds(
        groupsInput,
        (id) => predByMatch.get(id) ?? null
      );
      const pickBySlot = new Map(picks.map((p) => [p.slot, p]));
      const resolved = resolveWithScores(standingsByGroup, thirds, (slot): SlotScore => {
        const p = pickBySlot.get(slot);
        return { home: p?.homeScore ?? null, away: p?.awayScore ?? null, pen: p?.winnerTeamId ?? null };
      });
      for (const p of picks) {
        if (p.homeScore == null || p.awayScore == null) continue;
        const r = resolved[p.slot];
        if (!r) continue;
        // Marcador del bracket literal: empate cuenta como empate (sin penaltis).
        addMatch(r.homeTeamId, r.awayTeamId, p.homeScore, p.awayScore);
      }
    }
  }

  return CONFEDERATIONS.map((conf) => ({ conf, ...tally[conf] }));
}

// ─── Evolución del ranking partido a partido ──────────────────────────────────

export type RankEvolution = {
  matchLabels: string[];
  series: { userId: string; name: string; positions: number[] }[];
};

// Vida idéntica a la clasificación → tag "standings" cubre la invalidación.
export function getRankEvolution() {
  return cached("standings:evolution", 60_000, computeRankEvolution);
}

async function computeRankEvolution(): Promise<RankEvolution> {
  const [users, playedMatches, predictions, bracketPicks] = await Promise.all([
    prisma.user.findMany({
      where: { role: { not: "ADMIN" } },
      select: { id: true, name: true },
    }),
    prisma.match.findMany({
      where: { homeScore: { not: null }, awayScore: { not: null } },
      orderBy: { kickoff: "asc" },
      select: {
        id: true,
        stage: true,
        kickoff: true,
        label: true,
        homeTeam: { select: { code: true } },
        awayTeam: { select: { code: true } },
      },
    }),
    prisma.prediction.findMany({ select: { userId: true, matchId: true, points: true } }),
    prisma.bracketPick.findMany({ select: { userId: true, slot: true, points: true } }),
  ]);

  const userIds = new Set(users.map((u) => u.id));

  // Aportes por partido (grupos) y por slot (KO), solo de usuarios no-admin.
  const predByMatch = new Map<number, Map<string, number>>();
  for (const p of predictions) {
    if (!userIds.has(p.userId)) continue;
    const mm = predByMatch.get(p.matchId) ?? new Map<string, number>();
    mm.set(p.userId, p.points);
    predByMatch.set(p.matchId, mm);
  }
  const bracketBySlot = new Map<string, Map<string, number>>();
  for (const bp of bracketPicks) {
    if (!userIds.has(bp.userId)) continue;
    const mm = bracketBySlot.get(bp.slot) ?? new Map<string, number>();
    mm.set(bp.userId, bp.points);
    bracketBySlot.set(bp.slot, mm);
  }

  const koMatches = playedMatches
    .filter((m) => m.stage !== "GROUP")
    .map((m) => ({ id: m.id, stage: m.stage as string, kickoff: m.kickoff }));
  const slotByMatch = koSlotByMatchId(koMatches);

  // Acumuladores por usuario.
  type Acc = { total: number; exact: number; diff: number; results: number };
  const acc = new Map<string, Acc>(
    users.map((u) => [u.id, { total: 0, exact: 0, diff: 0, results: 0 }])
  );
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const positions = new Map<string, number[]>(users.map((u) => [u.id, []]));
  const matchLabels: string[] = [];

  for (const m of playedMatches) {
    if (m.stage === "GROUP") {
      const contrib = predByMatch.get(m.id);
      if (contrib) {
        for (const [userId, pts] of contrib) {
          const a = acc.get(userId);
          if (!a) continue;
          a.total += pts;
          // exact/diff/results acumulados solo de grupos (igual que getStandings).
          if (pts === POINTS.EXACT) a.exact++;
          else if (pts === POINTS.DIFF) a.diff++;
          else if (pts === POINTS.RESULT) a.results++;
        }
      }
    } else {
      const slot = slotByMatch.get(m.id);
      const contrib = slot ? bracketBySlot.get(slot) : undefined;
      if (contrib) {
        for (const [userId, pts] of contrib) {
          const a = acc.get(userId);
          if (a) a.total += pts;
        }
      }
    }

    // Re-ranking con el mismo desempate que getStandings.
    const ranked = [...users].sort((x, y) => {
      const ax = acc.get(x.id)!;
      const ay = acc.get(y.id)!;
      return (
        ay.total - ax.total ||
        ay.exact - ax.exact ||
        ay.diff - ax.diff ||
        ay.results - ax.results ||
        x.name.localeCompare(y.name)
      );
    });
    ranked.forEach((u, i) => positions.get(u.id)!.push(i + 1));

    matchLabels.push(
      m.label ?? `${m.homeTeam?.code ?? "?"}-${m.awayTeam?.code ?? "?"}`
    );
  }

  return {
    matchLabels,
    series: users.map((u) => ({
      userId: u.id,
      name: nameById.get(u.id)!,
      positions: positions.get(u.id)!,
    })),
  };
}

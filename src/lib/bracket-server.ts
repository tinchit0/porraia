import { prisma } from "@/lib/db";
import {
  computeStandingsAndThirds,
  resolveWithScores,
  winnersByRound,
  roundOf,
  type GroupForStandings,
  type SlotScore,
  type ResolvedSlot,
  type ThirdTeam,
} from "@/lib/bracket";
import { KNOCKOUT_POINTS, scoreMatchResult } from "@/lib/scoring";

/** Grupos con equipos (ordenados por bombo) y sus partidos de fase de grupos. */
export async function loadGroupsForBracket() {
  const groups = await prisma.group.findMany({
    orderBy: { name: "asc" },
    include: {
      teams: { orderBy: { id: "asc" }, select: { id: true, name: true, flag: true } },
      matches: {
        where: { stage: "GROUP" },
        select: { id: true, homeTeamId: true, awayTeamId: true },
      },
    },
  });
  return groups;
}

type LoadedGroups = Awaited<ReturnType<typeof loadGroupsForBracket>>;

/** Convierte los grupos cargados al formato que necesita el motor del cuadro. */
function toStandingsInput(groups: LoadedGroups): GroupForStandings[] {
  return groups.map((g) => ({
    name: g.name,
    teams: g.teams.map((t, i) => ({ teamId: t.id, seed: i })),
    matches: g.matches
      .filter((m) => m.homeTeamId != null && m.awayTeamId != null)
      .map((m) => ({ id: m.id, homeTeamId: m.homeTeamId!, awayTeamId: m.awayTeamId! })),
  }));
}

/** Clasificación real por grupo (ids ordenados) y 8 mejores terceros. */
export async function getRealStandingsInput(): Promise<{
  standingsByGroup: Record<string, number[]>;
  thirds: ThirdTeam[];
}> {
  const [groups, matches] = await Promise.all([
    loadGroupsForBracket(),
    prisma.match.findMany({
      where: { stage: "GROUP" },
      select: { id: true, homeScore: true, awayScore: true },
    }),
  ]);
  const scoreByMatch = new Map(
    matches
      .filter((m) => m.homeScore != null && m.awayScore != null)
      .map((m) => [m.id, { home: m.homeScore!, away: m.awayScore! }])
  );
  return computeStandingsAndThirds(toStandingsInput(groups), (id) => scoreByMatch.get(id) ?? null);
}

/** Resuelve el cuadro REAL a partir de los resultados de grupos y los cruces reales. */
export async function resolveRealBracket(): Promise<Record<string, ResolvedSlot>> {
  const [groups, matches, realKo] = await Promise.all([
    loadGroupsForBracket(),
    prisma.match.findMany({
      where: { stage: "GROUP" },
      select: { id: true, homeScore: true, awayScore: true },
    }),
    prisma.realKnockout.findMany(),
  ]);

  const scoreByMatch = new Map(
    matches
      .filter((m) => m.homeScore != null && m.awayScore != null)
      .map((m) => [m.id, { home: m.homeScore!, away: m.awayScore! }])
  );
  const koBySlot = new Map(realKo.map((k) => [k.slot, k]));

  const { standingsByGroup, thirds } = computeStandingsAndThirds(
    toStandingsInput(groups),
    (id) => scoreByMatch.get(id) ?? null
  );

  return resolveWithScores(standingsByGroup, thirds, (slot): SlotScore => {
    const k = koBySlot.get(slot);
    return { home: k?.homeScore ?? null, away: k?.awayScore ?? null, pen: k?.winnerTeamId ?? null };
  });
}

/**
 * Construye el cuadro real resuelto más el mapa de scores reales por slot.
 * Devuelve también los inputs de grupos para reutilizarlos al resolver el cuadro del usuario.
 */
async function buildRealContext() {
  const [groups, groupMatches, realKo] = await Promise.all([
    loadGroupsForBracket(),
    prisma.match.findMany({
      where: { stage: "GROUP" },
      select: { id: true, homeScore: true, awayScore: true },
    }),
    prisma.realKnockout.findMany(),
  ]);

  const realScoreByMatch = new Map(
    groupMatches
      .filter((m) => m.homeScore != null && m.awayScore != null)
      .map((m) => [m.id, { home: m.homeScore!, away: m.awayScore! }])
  );
  const groupsInput = toStandingsInput(groups);
  const { standingsByGroup: realStandings, thirds: realThirds } =
    computeStandingsAndThirds(groupsInput, (id) => realScoreByMatch.get(id) ?? null);

  const koBySlot = new Map(realKo.map((k) => [k.slot, k]));
  const realResolved = resolveWithScores(realStandings, realThirds, (slot): SlotScore => {
    const k = koBySlot.get(slot);
    return { home: k?.homeScore ?? null, away: k?.awayScore ?? null, pen: k?.winnerTeamId ?? null };
  });

  return { groupsInput, realResolved, koBySlot };
}

/** Puntúa todos los bracketPicks de un usuario. */
async function scoreUserBracket(
  userId: string,
  groupsInput: GroupForStandings[],
  realResolved: Record<string, ResolvedSlot>,
  koBySlot: Map<string, { slot: string; homeScore: number | null; awayScore: number | null; winnerTeamId: number | null }>
): Promise<void> {
  const [userPreds, userPicks] = await Promise.all([
    prisma.prediction.findMany({
      where: { userId },
      select: { matchId: true, homeScore: true, awayScore: true },
    }),
    prisma.bracketPick.findMany({ where: { userId } }),
  ]);

  const predByMatch = new Map(userPreds.map((p) => [p.matchId, { home: p.homeScore, away: p.awayScore }]));
  const { standingsByGroup, thirds } = computeStandingsAndThirds(
    groupsInput,
    (id) => predByMatch.get(id) ?? null
  );

  const pickBySlot = new Map(userPicks.map((p) => [p.slot, p]));
  const userResolved = resolveWithScores(standingsByGroup, thirds, (slot): SlotScore => {
    const p = pickBySlot.get(slot);
    return { home: p?.homeScore ?? null, away: p?.awayScore ?? null, pen: p?.winnerTeamId ?? null };
  });

  const realWinners = winnersByRound(realResolved);

  await Promise.all(
    userPicks.map((p) => {
      const round = roundOf(p.slot);

      // Puntos por avance (el equipo que predijiste que gana el cruce y ganó de verdad)
      const hit = p.winnerTeamId != null && realWinners[round]?.has(p.winnerTeamId);
      const advPts = hit ? KNOCKOUT_POINTS[round] ?? 0 : 0;

      // Puntos por resultado del partido: solo si ambos equipos coinciden con el real
      let matchPts = 0;
      const realSlot = realResolved[p.slot];
      const userSlot = userResolved[p.slot];
      const realScore = koBySlot.get(p.slot);
      if (
        realSlot?.homeTeamId != null &&
        realSlot?.awayTeamId != null &&
        userSlot?.homeTeamId === realSlot.homeTeamId &&
        userSlot?.awayTeamId === realSlot.awayTeamId &&
        realScore?.homeScore != null &&
        realScore?.awayScore != null &&
        p.homeScore != null &&
        p.awayScore != null
      ) {
        matchPts = scoreMatchResult(p.homeScore, p.awayScore, realScore.homeScore, realScore.awayScore);
      }

      return prisma.bracketPick.update({ where: { id: p.id }, data: { points: advPts + matchPts } });
    })
  );
}

/**
 * Recalcula y cachea los puntos del cuadro de un usuario.
 */
export async function recomputeBracket(userId: string): Promise<void> {
  const { groupsInput, realResolved, koBySlot } = await buildRealContext();
  await scoreUserBracket(userId, groupsInput, realResolved, koBySlot);
}

/** Recalcula el cuadro de todos los usuarios (tras editar resultados reales). */
export async function recomputeAllBrackets(): Promise<void> {
  const [{ groupsInput, realResolved, koBySlot }, users] = await Promise.all([
    buildRealContext(),
    prisma.user.findMany({ select: { id: true } }),
  ]);

  await Promise.all(
    users.map((u) => scoreUserBracket(u.id, groupsInput, realResolved, koBySlot))
  );
}

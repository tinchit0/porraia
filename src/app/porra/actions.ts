"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { invalidate } from "@/lib/cache";
import { getCurrentUser } from "@/lib/session";
import { BRACKET } from "@/lib/bracket";

export type SaveState = { ok?: boolean; error?: string } | undefined;

function parseScore(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 99) return null;
  return n;
}

export async function savePorraAction(
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Debes iniciar sesión." };

  const now = new Date();

  // Predicciones de la fase de grupos — solo partidos que aún no hayan empezado
  const matches = await prisma.match.findMany({
    where: { stage: "GROUP" },
    select: { id: true, kickoff: true },
  });

  for (const m of matches) {
    if (m.kickoff <= now) continue;

    const home = parseScore(formData.get(`m_${m.id}_home`));
    const away = parseScore(formData.get(`m_${m.id}_away`));

    if (home == null || away == null) {
      await prisma.prediction.deleteMany({
        where: { userId: user.id, matchId: m.id },
      });
      continue;
    }

    await prisma.prediction.upsert({
      where: { userId_matchId: { userId: user.id, matchId: m.id } },
      update: { homeScore: home, awayScore: away },
      create: { userId: user.id, matchId: m.id, homeScore: home, awayScore: away },
    });
  }

  // Primer pitido por ronda de eliminatorias
  const knockoutMatches = await prisma.match.findMany({
    where: { stage: { in: ["R32", "R16", "QF", "SF", "FINAL", "THIRD"] } },
    select: { stage: true, kickoff: true },
    orderBy: { kickoff: "asc" },
  });
  const stageToRound: Record<string, string> = {
    R32: "R32", R16: "R16", QF: "QF", SF: "SF", FINAL: "F", THIRD: "THIRD",
  };
  const roundDeadline: Record<string, Date> = {};
  for (const m of knockoutMatches) {
    const round = stageToRound[m.stage];
    if (round && !(round in roundDeadline)) roundDeadline[round] = m.kickoff;
  }

  // Cuadro de eliminatorias — solo rondas cuyo primer partido aún no haya empezado
  for (const bs of BRACKET) {
    const deadline = roundDeadline[bs.round];
    if (deadline && deadline <= now) continue;

    const home = parseScore(formData.get(`k_${bs.slot}_home`));
    const away = parseScore(formData.get(`k_${bs.slot}_away`));
    const winRaw = formData.get(`k_${bs.slot}_win`);
    const winnerTeamId = winRaw ? Number(winRaw) : null;

    if (home == null || away == null) {
      await prisma.bracketPick.deleteMany({ where: { userId: user.id, slot: bs.slot } });
      continue;
    }
    await prisma.bracketPick.upsert({
      where: { userId_slot: { userId: user.id, slot: bs.slot } },
      update: { homeScore: home, awayScore: away, winnerTeamId },
      create: { userId: user.id, slot: bs.slot, homeScore: home, awayScore: away, winnerTeamId },
    });
  }

  // El usuario cambió sus pronósticos: invalida clasificación, stats (mapa/
  // confederaciones/evolución) y jornada.
  invalidate("standings");
  invalidate("stats");
  invalidate("jornada");

  revalidatePath("/porra");
  revalidatePath("/clasificacion");
  return { ok: true };
}

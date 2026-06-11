"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { isLocked } from "@/lib/lock";
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
  if (await isLocked()) return { error: "La porra ya está bloqueada." };

  const matches = await prisma.match.findMany({
    where: { stage: "GROUP" },
    select: { id: true },
  });

  // Predicciones de marcador de la fase de grupos
  for (const m of matches) {
    const home = parseScore(formData.get(`m_${m.id}_home`));
    const away = parseScore(formData.get(`m_${m.id}_away`));

    if (home == null || away == null) {
      // Si la predicción está incompleta o vacía, la eliminamos (si existía).
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

  // Cuadro de eliminatorias
  for (const bs of BRACKET) {
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

  revalidatePath("/porra");
  revalidatePath("/clasificacion");
  return { ok: true };
}

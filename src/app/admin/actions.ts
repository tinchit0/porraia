"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { invalidate } from "@/lib/cache";
import { getCurrentUser } from "@/lib/session";
import { recomputeMatch } from "@/lib/recompute";
import { recomputeAllBrackets } from "@/lib/bracket-server";
import { BRACKET } from "@/lib/bracket";

export type AdminState = { ok?: boolean; error?: string } | undefined;

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

function parseScore(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 99) return null;
  return n;
}

/** Guarda los marcadores de la fase de grupos y recalcula la clasificación. */
export async function saveGroupResultsAction(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  if (!(await requireAdmin())) return { error: "No autorizado." };

  const matches = await prisma.match.findMany({
    where: { stage: "GROUP" },
    select: { id: true },
  });

  for (const m of matches) {
    const home = parseScore(formData.get(`m_${m.id}_home`));
    const away = parseScore(formData.get(`m_${m.id}_away`));

    if (home == null || away == null) {
      await prisma.match.update({
        where: { id: m.id },
        data: { homeScore: null, awayScore: null, status: "SCHEDULED" },
      });
    } else {
      await prisma.match.update({
        where: { id: m.id },
        data: { homeScore: home, awayScore: away, status: "FINISHED" },
      });
    }
    await recomputeMatch(m.id);
  }

  // La clasificación de grupos afecta a los emparejamientos del cuadro real.
  await recomputeAllBrackets();

  invalidate(); // resultados nuevos: afecta a toda la caché global
  revalidatePath("/admin");
  revalidatePath("/clasificacion");
  revalidatePath("/jornada");
  return { ok: true };
}

/** Guarda los resultados reales del cuadro de eliminatorias y recalcula puntos. */
export async function saveRealBracketAction(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  if (!(await requireAdmin())) return { error: "No autorizado." };

  for (const bs of BRACKET) {
    const home = parseScore(formData.get(`k_${bs.slot}_home`));
    const away = parseScore(formData.get(`k_${bs.slot}_away`));
    const winRaw = formData.get(`k_${bs.slot}_win`);
    const winnerTeamId = winRaw ? Number(winRaw) : null;

    if (home == null || away == null) {
      await prisma.realKnockout.deleteMany({ where: { slot: bs.slot } });
      continue;
    }
    await prisma.realKnockout.upsert({
      where: { slot: bs.slot },
      update: { homeScore: home, awayScore: away, winnerTeamId },
      create: { slot: bs.slot, homeScore: home, awayScore: away, winnerTeamId },
    });
  }

  await recomputeAllBrackets();

  invalidate(); // resultados del cuadro: afecta a toda la caché global
  revalidatePath("/admin");
  revalidatePath("/clasificacion");
  revalidatePath("/jornada");
  return { ok: true };
}


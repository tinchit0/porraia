import { prisma } from "@/lib/db";

/** Devuelve el instante de bloqueo de la porra (primer pitido inicial del torneo). */
export async function getLockAt(): Promise<Date> {
  const settings = await prisma.settings.findFirst();
  if (settings?.lockAt) return settings.lockAt;
  // Fallback a la variable de entorno si no hay fila de settings.
  const env = process.env.LOCK_AT;
  return env ? new Date(env) : new Date("2026-06-11T18:00:00.000Z");
}

/** True si la porra ya está bloqueada (no editable). */
export async function isLocked(): Promise<boolean> {
  const lockAt = await getLockAt();
  return Date.now() >= lockAt.getTime();
}

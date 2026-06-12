import { prisma } from "@/lib/db";
import { cached } from "@/lib/cache";

/** Devuelve el instante de bloqueo de la porra (primer pitido inicial del torneo). */
export async function getLockAt(): Promise<Date> {
  // Cacheado como epoch ms; se invalida con el tag "settings" (TTL 5 min de colchón).
  const ms = await cached("settings:lockAt", 300_000, async () => {
    const settings = await prisma.settings.findFirst();
    if (settings?.lockAt) return settings.lockAt.getTime();
    // Fallback a la variable de entorno si no hay fila de settings.
    const env = process.env.LOCK_AT;
    return env
      ? new Date(env).getTime()
      : new Date("2026-06-11T18:00:00.000Z").getTime();
  });
  return new Date(ms);
}

/** True si la porra ya está bloqueada (no editable). */
export async function isLocked(): Promise<boolean> {
  const lockAt = await getLockAt();
  return Date.now() >= lockAt.getTime();
}

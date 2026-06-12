/**
 * Caché en memoria de proceso para datos GLOBALES (idénticos para todos los
 * usuarios): clasificación, mapa de goles, partidos, pronósticos ya visibles…
 *
 * En producción corremos una sola instancia (`output: "standalone"`), así que
 * un Map a nivel de módulo persiste entre peticiones y se comparte por todos.
 *
 * Hace dos cosas que evitan que la VM pequeña se sature con varios usuarios a
 * la vez:
 *
 *  1. Cachea el resultado durante `ttlMs`, evitando recalcular en cada visita.
 *  2. De-duplica cálculos en vuelo: si llegan 10 peticiones a la vez con la
 *     caché fría, el cálculo se ejecuta UNA sola vez y las otras 9 esperan la
 *     misma promesa. Esto es clave con better-sqlite3, que es SÍNCRONO y
 *     bloquea el event loop en cada consulta: sin esto, N visitas simultáneas
 *     ejecutan N veces el mismo trabajo pesado y la tumban.
 *
 * La invalidación es inmediata y local al proceso: las server actions llaman a
 * `invalidate(...)` tras una mutación y la siguiente visita recalcula.
 */

type Entry = { value: unknown; expires: number };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  // Si ya hay un cálculo idéntico en marcha, nos colgamos de su promesa.
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = (async () => {
    try {
      const value = await fn();
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise as Promise<T>;
}

/**
 * Invalida entradas cuya clave sea `prefix` o empiece por `prefix:`.
 * Sin argumento, vacía toda la caché (útil tras acciones de admin, raras).
 */
export function invalidate(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key === prefix || key.startsWith(prefix + ":")) store.delete(key);
  }
}

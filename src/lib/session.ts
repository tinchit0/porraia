import { auth } from "@/lib/auth";

/** Devuelve el usuario de la sesión actual, o null si no hay sesión. */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

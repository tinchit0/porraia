"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/db";
import { invalidate } from "@/lib/cache";
import { signIn, signOut } from "@/lib/auth";

const registerSchema = z.object({
  name: z.string().trim().min(2, "El nombre es demasiado corto"),
  email: z.string().trim().email("Email no válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export type AuthState = { error?: string } | undefined;

export async function registerAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Ya existe una cuenta con ese correo" };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.create({
    data: { name: parsed.data.name, email, passwordHash },
  });

  invalidate("standings"); // nuevo participante en la clasificación
  invalidate("stats"); // afecta a las vistas de pronósticos (mapa/confederaciones)

  // Auto-login tras registrar (lanza redirect a /porra).
  await signIn("credentials", {
    email,
    password: parsed.data.password,
    redirectTo: "/porra",
  });
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/porra");

  if (!email || !password) {
    return { error: "Introduce tu correo y contraseña" };
  }

  try {
    await signIn("credentials", { email, password, redirectTo: callbackUrl });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Correo o contraseña incorrectos" };
    }
    throw error; // re-lanza el redirect de Next
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

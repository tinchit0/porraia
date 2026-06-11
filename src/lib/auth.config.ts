import type { NextAuthConfig } from "next-auth";

/**
 * Configuración compartida y edge-safe (sin Prisma ni bcrypt).
 * La usa tanto el middleware como la instancia completa de NextAuth.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  providers: [], // los providers reales se añaden en auth.ts (entorno Node)
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: string }).role ?? "USER";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as "USER" | "ADMIN") ?? "USER";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

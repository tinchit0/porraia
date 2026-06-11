import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

// Rutas que requieren sesión iniciada.
const PROTECTED = ["/porra", "/clasificacion", "/jornada", "/admin"];

// Proxy (antes "middleware"). En Next 16 corre en runtime Node.js por defecto.
export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;
  const path = nextUrl.pathname;

  const needsAuth = PROTECTED.some(
    (p) => path === p || path.startsWith(p + "/")
  );

  if (needsAuth && !isLoggedIn) {
    const url = new URL("/login", nextUrl);
    url.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(url);
  }

  // Solo ADMIN puede entrar a /admin
  if ((path === "/admin" || path.startsWith("/admin/")) && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Excluye estáticos, imágenes, api y ficheros con extensión.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

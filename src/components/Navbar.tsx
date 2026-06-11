import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { logoutAction } from "@/lib/actions/auth-actions";

const NAV = [
  { href: "/normas", label: "Normas" },
  { href: "/porra", label: "Mi porra" },
  { href: "/jornada", label: "Jornada" },
  { href: "/clasificacion", label: "Clasificación" },
  { href: "/mapa", label: "Mapa" },
];

export async function Navbar() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
          <span>PORR<span className="text-accent">AIA</span></span>
        </Link>

        {user && (
          <div className="hidden items-center gap-1 sm:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            {user.role === "ADMIN" && (
              <Link
                href="/admin"
                className="rounded-lg px-3 py-2 text-sm font-medium text-accent transition hover:bg-surface"
              >
                Admin
              </Link>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-sm text-muted md:inline">
                {user.name}
              </span>
              <form action={logoutAction}>
                <button type="submit" className="btn-ghost px-3 py-1.5 text-sm">
                  Salir
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost px-3 py-1.5 text-sm">
                Entrar
              </Link>
              <Link href="/registro" className="btn-primary px-3 py-1.5 text-sm">
                Registrarse
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Nav móvil */}
      {user && (
        <div className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 sm:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          {user.role === "ADMIN" && (
            <Link
              href="/admin"
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-accent"
            >
              Admin
            </Link>
          )}
        </div>
      )}
    </header>
  );
}

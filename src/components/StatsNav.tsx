"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/stats/mapa", label: "Mapa" },
  { href: "/stats/ranking", label: "Ranking" },
  { href: "/stats/confederaciones", label: "Confederaciones" },
];

export function StatsNav() {
  const pathname = usePathname();
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`chip transition ${
              active
                ? "border-primary bg-primary/20 text-green-200"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

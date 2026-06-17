import Link from "next/link";
import type { StatsView } from "@/lib/stats";

/** Conmutador "según pronósticos" / "según resultados reales" (chips con query param). */
export function ViewToggle({ base, current }: { base: string; current: StatsView }) {
  const chip = (view: StatsView, label: string) => (
    <Link
      href={`${base}?view=${view}`}
      className={`chip transition ${
        current === view
          ? "border-primary bg-primary/20 text-green-200"
          : "text-muted hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex flex-wrap gap-2">
      {chip("pred", "Según pronósticos")}
      {chip("real", "Según resultados reales")}
    </div>
  );
}

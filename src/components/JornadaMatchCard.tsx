"use client";

import { useState } from "react";
import { scoreMatchResult } from "@/lib/scoring";

export type ParticipantPred = { name: string; homeScore: number; awayScore: number };

type Cat = "exact" | "diff" | "result" | "miss";
const CAT_ORDER: Cat[] = ["exact", "diff", "result", "miss"];
const CAT_EMOJI: Record<Cat, string> = {
  exact: "🎯",
  diff: "🔥",
  result: "✅",
  miss: "❌",
};
const CAT_LABEL: Record<Cat, string> = {
  exact: "Marcador exacto",
  diff: "Diferencia de goles",
  result: "1X2 correcto",
  miss: "Fallo",
};

function catOf(p: ParticipantPred, rh: number, ra: number): Cat {
  const pts = scoreMatchResult(p.homeScore, p.awayScore, rh, ra);
  if (pts === 3) return "exact";
  if (pts === 2) return "diff";
  if (pts === 1) return "result";
  return "miss";
}

export function JornadaMatchCard({
  locked,
  allPreds,
  realHome,
  realAway,
  children,
}: {
  locked: boolean;
  allPreds: ParticipantPred[];
  realHome: number | null;
  realAway: number | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (!locked || allPreds.length === 0) return <>{children}</>;

  const hasResult = realHome != null && realAway != null;

  const grouped: { cat: Cat; preds: ParticipantPred[] }[] = hasResult
    ? CAT_ORDER.map((cat) => ({
        cat,
        preds: allPreds.filter((p) => catOf(p, realHome, realAway) === cat),
      })).filter((g) => g.preds.length > 0)
    : [];

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((v) => !v)}
    >
      {children}
      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-border bg-surface p-3 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-2 border-b border-border pb-2 text-xs font-semibold text-muted">
            👥 {allPreds.length} pronóstico{allPreds.length !== 1 ? "s" : ""}
          </p>
          {hasResult ? (
            <div className="space-y-2.5">
              {grouped.map(({ cat, preds }) => (
                <div key={cat}>
                  <p className="mb-1 text-xs font-semibold text-muted">
                    {CAT_EMOJI[cat]} {CAT_LABEL[cat]}
                  </p>
                  <div className="space-y-0.5">
                    {preds.map((p, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate">{p.name}</span>
                        <span className="shrink-0 tabular-nums text-muted">
                          {p.homeScore}-{p.awayScore}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-0.5">
              {allPreds.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {p.homeScore}-{p.awayScore}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

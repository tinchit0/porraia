"use client";

import { startTransition, useActionState, useMemo, useState } from "react";
import { saveRealBracketAction, type AdminState } from "@/app/admin/actions";
import {
  resolveWithScores,
  BRACKET,
  ROUND_LABELS,
  ROUND_ORDER,
  type ResolvedSlot,
  type SlotScore,
  type ThirdTeam,
} from "@/lib/bracket";

type Team = { id: number; name: string; flag: string };
type Picks = Record<string, { home: string; away: string; pen: number | null }>;

const toInt = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 && n <= 99 ? n : null;
};
const numStr = (n: number | null | undefined) => (n == null ? "" : String(n));

export function AdminBracket({
  standingsByGroup,
  thirds,
  teamsById,
  realPicks,
}: {
  standingsByGroup: Record<string, number[]>;
  thirds: ThirdTeam[];
  teamsById: Record<number, Team>;
  realPicks: Record<string, { home: number | null; away: number | null; pen: number | null }>;
}) {
  const [picks, setPicks] = useState<Picks>(() => {
    const init: Picks = {};
    for (const bs of BRACKET) {
      const p = realPicks[bs.slot];
      init[bs.slot] = { home: numStr(p?.home), away: numStr(p?.away), pen: p?.pen ?? null };
    }
    return init;
  });

  const [state, dispatch, isPending] = useActionState<AdminState, FormData>(
    saveRealBracketAction,
    undefined
  );

  const resolved = useMemo(
    () =>
      resolveWithScores(standingsByGroup, thirds, (slot): SlotScore => {
        const p = picks[slot];
        return { home: toInt(p?.home ?? ""), away: toInt(p?.away ?? ""), pen: p?.pen ?? null };
      }),
    [standingsByGroup, thirds, picks]
  );

  const hasGroups = Object.values(standingsByGroup).some((g) => g[0] != null);

  function save() {
    const fd = new FormData();
    for (const bs of BRACKET) {
      const r = resolved[bs.slot];
      fd.set(`k_${bs.slot}_home`, picks[bs.slot]?.home ?? "");
      fd.set(`k_${bs.slot}_away`, picks[bs.slot]?.away ?? "");
      fd.set(`k_${bs.slot}_win`, r?.winnerTeamId != null ? String(r.winnerTeamId) : "");
    }
    startTransition(() => dispatch(fd));
  }

  return (
    <div>
      {state?.ok && (
        <p className="mb-3 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm text-green-300">
          ✓ Cuadro real guardado y puntos recalculados.
        </p>
      )}
      {!hasGroups && (
        <p className="mb-3 rounded-lg border border-border bg-surface px-4 py-2 text-sm text-muted">
          Introduce primero los resultados de la fase de grupos para que se calculen los
          clasificados de cada cruce.
        </p>
      )}

      <div className="space-y-4">
        {ROUND_ORDER.map((round) => (
          <section key={round} className="card p-4">
            <h3 className="mb-2 font-bold">{ROUND_LABELS[round]}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {BRACKET.filter((b) => b.round === round).map((b) => (
                <Match
                  key={b.slot}
                  resolved={resolved[b.slot]}
                  pick={picks[b.slot]}
                  teamsById={teamsById}
                  onScore={(side, v) =>
                    setPicks((p) => ({ ...p, [b.slot]: { ...p[b.slot], [side]: v } }))
                  }
                  onPen={(id) =>
                    setPicks((p) => ({ ...p, [b.slot]: { ...p[b.slot], pen: id } }))
                  }
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="sticky bottom-4 mt-4 flex justify-center">
        <button type="button" disabled={isPending} onClick={save} className="btn-accent px-6">
          {isPending ? "Guardando…" : "💾 Guardar cuadro real y recalcular"}
        </button>
      </div>
    </div>
  );
}

function Match({
  resolved,
  pick,
  teamsById,
  onScore,
  onPen,
}: {
  resolved?: ResolvedSlot;
  pick?: { home: string; away: string; pen: number | null };
  teamsById: Record<number, Team>;
  onScore: (side: "home" | "away", v: string) => void;
  onPen: (id: number) => void;
}) {
  const home = resolved?.homeTeamId ? teamsById[resolved.homeTeamId] : undefined;
  const away = resolved?.awayTeamId ? teamsById[resolved.awayTeamId] : undefined;
  const ready = !!home && !!away;
  const h = toInt(pick?.home ?? "");
  const a = toInt(pick?.away ?? "");
  const isDraw = h != null && a != null && h === a;
  const winner = resolved?.winnerTeamId ? teamsById[resolved.winnerTeamId] : undefined;

  const box =
    "h-9 w-11 rounded-md border border-border bg-background text-center font-bold outline-none focus:border-primary disabled:opacity-60";

  return (
    <div className="rounded-lg bg-surface-2/60 p-2.5">
      <div className="flex items-center gap-2 text-sm">
        <span className="flex flex-1 items-center justify-end gap-1 truncate text-right">
          <span className="truncate">{home?.name ?? "—"}</span> {home?.flag}
        </span>
        <input type="number" min={0} max={99} value={pick?.home ?? ""} disabled={!ready} onChange={(e) => onScore("home", e.target.value)} className={box} />
        <span className="text-muted">-</span>
        <input type="number" min={0} max={99} value={pick?.away ?? ""} disabled={!ready} onChange={(e) => onScore("away", e.target.value)} className={box} />
        <span className="flex flex-1 items-center gap-1 truncate">
          {away?.flag} <span className="truncate">{away?.name ?? "—"}</span>
        </span>
      </div>
      {ready && isDraw && (
        <div className="mt-1.5 flex items-center justify-center gap-2 text-xs">
          <span className="text-muted">Penaltis →</span>
          <button type="button" onClick={() => onPen(resolved!.homeTeamId!)} className={`chip ${pick?.pen === resolved!.homeTeamId ? "border-primary bg-primary/20 text-green-200" : ""}`}>
            {home?.flag}
          </button>
          <button type="button" onClick={() => onPen(resolved!.awayTeamId!)} className={`chip ${pick?.pen === resolved!.awayTeamId ? "border-primary bg-primary/20 text-green-200" : ""}`}>
            {away?.flag}
          </button>
        </div>
      )}
      {winner && (
        <p className="mt-1 text-center text-xs text-green-300">✓ {winner.flag} {winner.name}</p>
      )}
    </div>
  );
}

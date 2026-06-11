"use client";

import { Fragment, startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { savePorraAction, type SaveState } from "@/app/porra/actions";
import {
  computeGroupStandings,
  selectBestThirds,
  resolveWithScores,
  BRACKET,
  ROUND_LABELS,
  ROUND_TAB_LABELS,
  ROUND_FULL_LABELS,
  ROUND_ORDER,
  type StandingRow,
  type ResolvedSlot,
  type SlotScore,
} from "@/lib/bracket";

export type TeamLite = { id: number; name: string; flag: string };
export type MatchLite = { id: number; matchday: number; homeId: number; awayId: number; kickoff: string };
export type GroupBlock = { name: string; teams: TeamLite[]; matches: MatchLite[] };

export type EditorData = {
  groups: GroupBlock[];
  teamsById: Record<number, TeamLite>;
  predictions: Record<number, { home: number; away: number }>;
  bracketPicks: Record<string, { home: number | null; away: number | null; winnerTeamId?: number | null }>;
  roundDeadlines: Record<string, string>; // round → ISO kickoff del primer partido
};

type Scores = Record<number, { home: string; away: string }>;
type Picks = Record<string, { home: string; away: string; pen: number | null }>;

const FINAL_SLOT = "F-104";
const numStr = (n: number | null | undefined) => (n == null ? "" : String(n));
const toInt = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 && n <= 99 ? n : null;
};

const fmtKickoff = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const isMatchLocked = (kickoff: string) => new Date(kickoff) <= new Date();
const isRoundLocked = (round: string, deadlines: Record<string, string>) => {
  const d = deadlines[round];
  return d ? new Date(d) <= new Date() : false;
};

function DeadlineBadge({ deadline }: { deadline?: string }) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!deadline) return;
    const locked = new Date(deadline) <= new Date();
    setLabel(locked ? "🔒 Ronda iniciada" : `⏰ Plazo: ${fmtKickoff(deadline)}`);
  }, [deadline]);
  if (!label) return null;
  return <span className="text-xs text-muted">{label}</span>;
}

function ScoreBox({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <input
      type="number"
      min={0}
      max={99}
      inputMode="numeric"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-12 rounded-md border border-border bg-background text-center text-lg font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
    />
  );
}

function TeamTag({ team, align }: { team?: TeamLite; align: "l" | "r" }) {
  return (
    <span className={`flex flex-1 items-center gap-2 min-w-0 ${align === "r" ? "justify-end text-right" : ""}`}>
      {align === "l" && <span className="text-lg">{team?.flag ?? "·"}</span>}
      <span className="truncate text-sm font-medium">
        {team?.name ?? <span className="text-muted">Por definir</span>}
      </span>
      {align === "r" && <span className="text-lg">{team?.flag ?? "·"}</span>}
    </span>
  );
}

export function PorraEditor({ data }: { data: EditorData }) {
  const { groups, teamsById, predictions, bracketPicks, roundDeadlines } = data;

  const [scores, setScores] = useState<Scores>(() => {
    const init: Scores = {};
    for (const g of groups)
      for (const m of g.matches) {
        const p = predictions[m.id];
        init[m.id] = { home: numStr(p?.home), away: numStr(p?.away) };
      }
    return init;
  });
  const [picks, setPicks] = useState<Picks>(() => {
    const init: Picks = {};
    for (const bs of BRACKET) {
      const p = bracketPicks[bs.slot];
      init[bs.slot] = { home: numStr(p?.home), away: numStr(p?.away), pen: p?.winnerTeamId ?? null };
    }
    return init;
  });
  const [activeGroup, setActiveGroup] = useState(groups[0]?.name ?? "A");
  const [activeKo, setActiveKo] = useState<"cuadro" | string>("cuadro");

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [state, dispatch, isPending] = useActionState<SaveState, FormData>(
    savePorraAction,
    undefined
  );

  // Clasificación en vivo de cada grupo
  const standings = useMemo(() => {
    const out: Record<string, StandingRow[]> = {};
    for (const g of groups) {
      const teams = g.teams.map((t, i) => ({ teamId: t.id, seed: i }));
      const mm = g.matches.map((m) => {
        const s = scores[m.id];
        return {
          homeTeamId: m.homeId,
          awayTeamId: m.awayId,
          homeScore: toInt(s?.home ?? ""),
          awayScore: toInt(s?.away ?? ""),
        };
      });
      out[g.name] = computeGroupStandings(teams, mm);
    }
    return out;
  }, [groups, scores]);

  const thirds = useMemo(() => {
    const rows: { group: string; row: StandingRow }[] = [];
    for (const g of groups) if (standings[g.name][2]) rows.push({ group: g.name, row: standings[g.name][2] });
    return selectBestThirds(rows);
  }, [groups, standings]);

  const qualifiedThirds = useMemo(() => new Set(thirds.map((t) => t.teamId)), [thirds]);

  const resolved = useMemo(() => {
    const standingsByGroup: Record<string, number[]> = {};
    for (const g of groups) standingsByGroup[g.name] = standings[g.name].map((r) => r.teamId);
    return resolveWithScores(standingsByGroup, thirds, (slot): SlotScore => {
      const p = picks[slot];
      return { home: toInt(p?.home ?? ""), away: toInt(p?.away ?? ""), pen: p?.pen ?? null };
    });
  }, [groups, standings, thirds, picks]);

  const champion = resolved[FINAL_SLOT]?.winnerTeamId
    ? teamsById[resolved[FINAL_SLOT].winnerTeamId!]
    : undefined;

  const totalMatches = groups.reduce((n, g) => n + g.matches.length, 0);
  const filledMatches = useMemo(
    () => Object.values(scores).filter((s) => s.home !== "" && s.away !== "").length,
    [scores]
  );
  const isComplete = filledMatches === totalMatches && !!champion;

  function buildFormData(): FormData {
    const fd = new FormData();
    for (const g of groups)
      for (const m of g.matches) {
        fd.set(`m_${m.id}_home`, scores[m.id]?.home ?? "");
        fd.set(`m_${m.id}_away`, scores[m.id]?.away ?? "");
      }
    for (const bs of BRACKET) {
      const rs = resolved[bs.slot];
      fd.set(`k_${bs.slot}_home`, picks[bs.slot]?.home ?? "");
      fd.set(`k_${bs.slot}_away`, picks[bs.slot]?.away ?? "");
      fd.set(`k_${bs.slot}_win`, rs?.winnerTeamId != null ? String(rs.winnerTeamId) : "");
    }
    return fd;
  }

  function save() {
    startTransition(() => dispatch(buildFormData()));
  }

  const group = groups.find((g) => g.name === activeGroup) ?? groups[0];
  const koTabs: ("cuadro" | string)[] = ["cuadro", ...ROUND_ORDER.filter((r) => r !== "THIRD")];

  return (
    <div>
      {state?.ok && (
        <p className="mb-4 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm text-green-300">
          ✓ Porra guardada correctamente.
        </p>
      )}
      {state?.error && (
        <p className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-red-300">
          {state.error}
        </p>
      )}

      {/* ---------------- Fase de grupos ---------------- */}
      <h2 className="mb-3 text-xl font-bold">⚽ Fase de grupos</h2>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {groups.map((g) => (
          <button
            key={g.name}
            type="button"
            onClick={() => setActiveGroup(g.name)}
            className={`h-9 w-9 rounded-lg text-sm font-bold transition ${
              g.name === activeGroup
                ? "bg-primary text-primary-fg"
                : "border border-border bg-surface-2 text-muted hover:text-foreground"
            }`}
          >
            {g.name}
          </button>
        ))}
      </div>

      <section className="card p-5">
        <h3 className="mb-3">
          <span className="badge bg-primary text-primary-fg">Grupo {group.name}</span>
        </h3>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Marcadores */}
          <div className="space-y-4">
            {[1, 2, 3].map((md) => (
              <div key={md}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  Jornada {md}
                </p>
                <div className="space-y-2">
                  {group.matches
                    .filter((m) => m.matchday === md)
                    .map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-3 rounded-lg bg-surface-2/60 px-3 py-2.5"
                      >
                        <TeamTag team={teamsById[m.homeId]} align="r" />
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <ScoreBox
                              value={scores[m.id]?.home ?? ""}
                              disabled={isMatchLocked(m.kickoff)}
                              onChange={(v) =>
                                setScores((s) => ({ ...s, [m.id]: { ...s[m.id], home: v } }))
                              }
                            />
                            <span className="text-muted">-</span>
                            <ScoreBox
                              value={scores[m.id]?.away ?? ""}
                              disabled={isMatchLocked(m.kickoff)}
                              onChange={(v) =>
                                setScores((s) => ({ ...s, [m.id]: { ...s[m.id], away: v } }))
                              }
                            />
                          </div>
                          {mounted && (
                            <span className="text-[10px] leading-none text-muted">
                              {isMatchLocked(m.kickoff) ? "🔒" : fmtKickoff(m.kickoff)}
                            </span>
                          )}
                        </div>
                        <TeamTag team={teamsById[m.awayId]} align="l" />
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>

          {/* Clasificación + clasificados */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              Clasificación
            </p>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1 text-left">#</th>
                  <th className="py-1 text-left">Equipo</th>
                  <th className="py-1 text-center">PJ</th>
                  <th className="py-1 text-center">DG</th>
                  <th className="py-1 text-center">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings[group.name].map((r, i) => (
                  <tr key={r.teamId} className={i < 2 ? "text-foreground" : "text-muted"}>
                    <td className="py-1">{i + 1}</td>
                    <td className="py-1">
                      {teamsById[r.teamId]?.flag} {teamsById[r.teamId]?.name}
                    </td>
                    <td className="py-1 text-center">{r.played}</td>
                    <td className="py-1 text-center">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                    <td className="py-1 text-center font-bold">{r.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Recuadritos de clasificados (solo los que pasan) */}
            <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
              Clasificados
            </p>
            <div className="flex gap-2">
              {(() => {
                const rows = standings[group.name];
                const items: { pos: number; label: string; teamId: number }[] = [
                  { pos: 0, label: "1º", teamId: rows[0]?.teamId },
                  { pos: 1, label: "2º", teamId: rows[1]?.teamId },
                ];
                if (rows[2] && qualifiedThirds.has(rows[2].teamId)) {
                  items.push({ pos: 2, label: "Mejor 3º", teamId: rows[2].teamId });
                }
                return items.map((it) => {
                  const team = teamsById[it.teamId];
                  return (
                    <div
                      key={it.teamId}
                      className="flex flex-1 flex-col items-center rounded-lg border border-primary/40 bg-primary/10 p-2 text-center"
                    >
                      <span
                        className={`badge mb-1 ${
                          it.pos === 0
                            ? "bg-accent text-slate-900"
                            : it.pos === 1
                              ? "bg-primary text-primary-fg"
                              : "bg-green-500/30 text-green-200"
                        }`}
                      >
                        {it.label}
                      </span>
                      <span className="text-2xl">{team?.flag}</span>
                      <span className="mt-0.5 truncate text-xs">{team?.name}</span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Cuadro de eliminatorias ---------------- */}
      <h2 className="mb-3 mt-8 text-xl font-bold">🏟️ Cuadro de eliminatorias</h2>
      <p className="mb-3 text-sm text-muted">
        Se arma con la clasificación de tus grupos. Pon el marcador de cada cruce; si hay empate,
        elige quién pasa por penaltis.
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {koTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveKo(tab)}
            className={`chip transition ${
              tab === activeKo
                ? "border-primary bg-primary/20 text-green-200"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab === "cuadro" ? "🗺️ Cuadro" : ROUND_TAB_LABELS[tab as keyof typeof ROUND_TAB_LABELS]}
          </button>
        ))}
      </div>

      {activeKo === "cuadro" ? (
        <BracketDiagram resolved={resolved} teamsById={teamsById} champion={champion} />
      ) : (
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold">{ROUND_FULL_LABELS[activeKo as keyof typeof ROUND_FULL_LABELS]}</h3>
            <DeadlineBadge deadline={roundDeadlines[activeKo]} />
          </div>
          {activeKo === "F" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {(["THIRD", "F"] as const).map((rnd) => {
                const bs = BRACKET.find((b) => b.round === rnd)!;
                return (
                  <div key={rnd}>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                      {ROUND_FULL_LABELS[rnd]}
                    </p>
                    <BracketMatch
                      resolved={resolved[bs.slot]}
                      pick={picks[bs.slot]}
                      teamsById={teamsById}
                      locked={isRoundLocked(rnd, roundDeadlines)}
                      winnerLabel={rnd === "F" ? "🏆 campeón" : "🥉 tercero"}
                      onScore={(side, v) =>
                        setPicks((p) => ({ ...p, [bs.slot]: { ...p[bs.slot], [side]: v } }))
                      }
                      onPen={(id) =>
                        setPicks((p) => ({ ...p, [bs.slot]: { ...p[bs.slot], pen: id } }))
                      }
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {BRACKET.filter((b) => b.round === activeKo).map((b) => (
                <BracketMatch
                  key={b.slot}
                  resolved={resolved[b.slot]}
                  pick={picks[b.slot]}
                  teamsById={teamsById}
                  locked={isRoundLocked(activeKo, roundDeadlines)}
                  onScore={(side, v) =>
                    setPicks((p) => ({ ...p, [b.slot]: { ...p[b.slot], [side]: v } }))
                  }
                  onPen={(id) => setPicks((p) => ({ ...p, [b.slot]: { ...p[b.slot], pen: id } }))}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <div className="sticky bottom-4 z-10 mt-8 flex flex-col items-center gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={save}
          className={`px-8 shadow-xl shadow-black/40 ${isComplete ? "btn-accent" : "btn-ghost border-amber-500/60 text-amber-300 hover:bg-amber-500/10"}`}
        >
          {isPending ? "Guardando…" : isComplete ? "💾 Guardar mi porra" : "💾 Guardar (incompleta)"}
        </button>
        {!isComplete && (
          <p className="text-xs text-amber-400">
            {filledMatches < totalMatches
              ? `⚠ Faltan ${totalMatches - filledMatches} marcador${totalMatches - filledMatches === 1 ? "" : "es"} de grupo${!champion ? " y el campeón" : ""}`
              : "⚠ Falta elegir el campeón"}
          </p>
        )}
      </div>
    </div>
  );
}

// Recorre el árbol de una semifinal (DFS local→visitante) y agrupa los cruces por
// ronda en orden de arriba abajo, de modo que cada par consecutivo de una ronda
// alimenta el cruce correcto de la ronda siguiente.
function orderedByRound(root: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const visit = (slot: string) => {
    const bs = BRACKET.find((b) => b.slot === slot);
    if (!bs) return;
    (out[bs.round] ??= []).push(slot);
    for (const ref of [bs.home, bs.away]) if (ref.k === "m") visit(ref.s);
  };
  visit(root);
  return out;
}
const LEFT_ORDER = orderedByRound("SF-101");
const RIGHT_ORDER = orderedByRound("SF-102");
const SIDE_ROUNDS: ("R32" | "R16" | "QF" | "SF")[] = ["R32", "R16", "QF", "SF"];

function BracketCell({
  r,
  teamsById,
}: {
  r?: ResolvedSlot;
  teamsById: Record<number, TeamLite>;
}) {
  const Side = ({ id }: { id: number | null | undefined }) => {
    const team = id ? teamsById[id] : undefined;
    const isWin = id != null && id === r?.winnerTeamId;
    return (
      <div
        title={team?.name}
        className={`flex items-center justify-center rounded px-1 py-0.5 text-base ${
          isWin ? "bg-primary/25" : "opacity-70"
        }`}
      >
        <span>{team?.flag ?? "·"}</span>
      </div>
    );
  };
  return (
    <div className="rounded-md border border-border bg-surface-2/60 p-1">
      <Side id={r?.homeTeamId} />
      <Side id={r?.awayTeamId} />
    </div>
  );
}

function BracketColumn({
  round,
  slots,
  resolved,
  teamsById,
}: {
  round: "R32" | "R16" | "QF" | "SF";
  slots: string[];
  resolved: Record<string, ResolvedSlot>;
  teamsById: Record<number, TeamLite>;
}) {
  return (
    <div className="flex flex-1 min-w-14 flex-col">
      <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted">
        {ROUND_LABELS[round]}
      </p>
      <div className="flex flex-1 flex-col">
        {slots.map((slot) => (
          <div key={slot} className="flex flex-1 items-center justify-center px-0.5">
            <BracketCell r={resolved[slot]} teamsById={teamsById} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Líneas SVG que conectan dos columnas adyacentes del cuadro.
// count = nº de celdas en el lado con MÁS celdas.
// type "converge": izquierda tiene más, pares convergen a la derecha.
// type "diverge": derecha tiene más, izquierda diverge hacia la derecha.
function BracketConnector({ count, type }: { count: number; type: "converge" | "diverge" }) {
  const lp = { stroke: "currentColor", strokeWidth: "2", fill: "none", vectorEffect: "non-scaling-stroke" } as const;

  if (count === 1) {
    return (
      <div className="relative self-stretch text-border/50" style={{ width: 20, minWidth: 20 }}>
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line {...lp} x1="0" y1="50" x2="100" y2="50" />
        </svg>
      </div>
    );
  }

  const pairs = count / 2;
  const lines: React.ReactNode[] = [];
  for (let k = 0; k < pairs; k++) {
    const topY = ((4 * k + 1) / (2 * count)) * 100;
    const botY = ((4 * k + 3) / (2 * count)) * 100;
    const midY = ((4 * k + 2) / (2 * count)) * 100;
    if (type === "converge") {
      lines.push(
        <line key={`${k}a`} {...lp} x1="0"   y1={topY} x2="50"  y2={topY} />,
        <line key={`${k}b`} {...lp} x1="0"   y1={botY} x2="50"  y2={botY} />,
        <line key={`${k}c`} {...lp} x1="50"  y1={topY} x2="50"  y2={botY} />,
        <line key={`${k}d`} {...lp} x1="50"  y1={midY} x2="100" y2={midY} />,
      );
    } else {
      lines.push(
        <line key={`${k}a`} {...lp} x1="0"   y1={midY} x2="50"  y2={midY} />,
        <line key={`${k}b`} {...lp} x1="50"  y1={topY} x2="50"  y2={botY} />,
        <line key={`${k}c`} {...lp} x1="50"  y1={topY} x2="100" y2={topY} />,
        <line key={`${k}d`} {...lp} x1="50"  y1={botY} x2="100" y2={botY} />,
      );
    }
  }

  return (
    <div className="relative self-stretch text-border/50" style={{ width: 20, minWidth: 20 }}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {lines}
      </svg>
    </div>
  );
}

function loserTeam(
  resolved: Record<string, ResolvedSlot>,
  teamsById: Record<number, TeamLite>,
  slot: string,
): TeamLite | undefined {
  const r = resolved[slot];
  if (!r || r.winnerTeamId == null) return undefined;
  const loserId = r.homeTeamId === r.winnerTeamId ? r.awayTeamId : r.homeTeamId;
  return loserId != null ? teamsById[loserId] : undefined;
}

function PodiumSlot({ medal, label, team }: { medal: string; label: string; team?: TeamLite }) {
  return (
    <div className="flex flex-col items-center rounded-md border border-border bg-surface-2/60 px-3 py-2 text-center">
      <span className="text-xs text-muted">{medal} {label}</span>
      <span className="mt-1 text-3xl">{team?.flag ?? "—"}</span>
      <span className="mt-0.5 max-w-full truncate text-xs">{team?.name ?? "—"}</span>
    </div>
  );
}

// Vista tipo cuadro a dos mitades con la final en el centro (solo banderas).
function BracketDiagram({
  resolved,
  teamsById,
  champion,
}: {
  resolved: Record<string, ResolvedSlot>;
  teamsById: Record<number, TeamLite>;
  champion?: TeamLite;
}) {
  const runnerUp     = loserTeam(resolved, teamsById, "F-104");
  const thirdWinner  = resolved["THIRD-103"]?.winnerTeamId
    ? teamsById[resolved["THIRD-103"].winnerTeamId]
    : undefined;
  const third1 = loserTeam(resolved, teamsById, "SF-101");
  const third2 = loserTeam(resolved, teamsById, "SF-102");

  return (
    <div className="card overflow-x-auto p-4">
      {/* Diagrama de bracket */}
      <div className="flex min-h-[28rem] w-full min-w-max items-stretch">
        {/* Mitad izquierda con conectores */}
        {SIDE_ROUNDS.map((round) => {
          const slots = LEFT_ORDER[round] ?? [];
          return (
            <Fragment key={`l-${round}`}>
              <BracketColumn round={round} slots={slots} resolved={resolved} teamsById={teamsById} />
              <BracketConnector count={slots.length} type="converge" />
            </Fragment>
          );
        })}

        {/* Centro: solo la final, sin caja de campeón */}
        <div className="flex min-w-20 flex-col px-1">
          <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-accent">
            Final
          </p>
          <div className="flex flex-1 items-center justify-center">
            <BracketCell r={resolved["F-104"]} teamsById={teamsById} />
          </div>
        </div>

        {/* Mitad derecha con conectores */}
        {[...SIDE_ROUNDS].reverse().map((round) => {
          const slots = RIGHT_ORDER[round] ?? [];
          return (
            <Fragment key={`r-${round}`}>
              <BracketConnector count={slots.length} type="diverge" />
              <BracketColumn round={round} slots={slots} resolved={resolved} teamsById={teamsById} />
            </Fragment>
          );
        })}
      </div>

      {/* Podio: campeón · subcampeón · partido por el 3er puesto */}
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4">
        <PodiumSlot medal="🥇" label="Campeón" team={champion} />
        <PodiumSlot medal="🥈" label="Subcampeón" team={runnerUp} />
        {thirdWinner ? (
          <PodiumSlot medal="🥉" label="Tercer puesto" team={thirdWinner} />
        ) : (
          <div className="flex flex-col items-center rounded-md border border-border bg-surface-2/60 px-3 py-2 text-center">
            <span className="text-xs text-muted">🥉 Tercer puesto</span>
            <div className="mt-1 flex items-center gap-1.5 text-base">
              <span title={third1?.name}>{third1?.flag ?? "·"}</span>
              <span className="text-xs text-muted">vs</span>
              <span title={third2?.name}>{third2?.flag ?? "·"}</span>
            </div>
            <span className="mt-0.5 max-w-full truncate text-xs text-muted">
              {third1 && third2 ? `${third1.name} · ${third2.name}` : "—"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function BracketMatch({
  resolved,
  pick,
  teamsById,
  locked,
  winnerLabel = "✓ pasa",
  onScore,
  onPen,
}: {
  resolved?: ResolvedSlot;
  pick?: { home: string; away: string; pen: number | null };
  teamsById: Record<number, TeamLite>;
  locked: boolean;
  winnerLabel?: string;
  onScore: (side: "home" | "away", v: string) => void;
  onPen: (teamId: number) => void;
}) {
  const home = resolved?.homeTeamId ? teamsById[resolved.homeTeamId] : undefined;
  const away = resolved?.awayTeamId ? teamsById[resolved.awayTeamId] : undefined;
  const ready = !!home && !!away;
  const h = toInt(pick?.home ?? "");
  const a = toInt(pick?.away ?? "");
  const isDraw = h != null && a != null && h === a;
  const winner = resolved?.winnerTeamId ? teamsById[resolved.winnerTeamId] : undefined;

  return (
    <div className="rounded-lg bg-surface-2/60 p-3">
      <div className="flex items-center gap-3">
        <TeamTag team={home} align="r" />
        <div className="flex items-center gap-1.5">
          <ScoreBox value={pick?.home ?? ""} disabled={locked || !ready} onChange={(v) => onScore("home", v)} />
          <span className="text-muted">-</span>
          <ScoreBox value={pick?.away ?? ""} disabled={locked || !ready} onChange={(v) => onScore("away", v)} />
        </div>
        <TeamTag team={away} align="l" />
      </div>

      {ready && isDraw && (
        <div className="mt-2 flex items-center justify-center gap-2 text-xs">
          <span className="text-muted">Penaltis →</span>
          <button
            type="button"
            disabled={locked}
            onClick={() => onPen(resolved!.homeTeamId!)}
            className={`chip ${pick?.pen === resolved!.homeTeamId ? "border-primary bg-primary/20 text-green-200" : ""}`}
          >
            {home?.flag} {home?.name}
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={() => onPen(resolved!.awayTeamId!)}
            className={`chip ${pick?.pen === resolved!.awayTeamId ? "border-primary bg-primary/20 text-green-200" : ""}`}
          >
            {away?.flag} {away?.name}
          </button>
        </div>
      )}

      {winner && (
        <p className="mt-1.5 text-center text-xs text-green-300">
          {winnerLabel} {winner.flag} {winner.name}
        </p>
      )}
    </div>
  );
}

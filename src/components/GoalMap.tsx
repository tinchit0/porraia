"use client";

import { useState } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";

export type TeamGoalData = {
  code: string;
  name: string;
  flag: string;
  avgGoals: number;
  predCount: number;
};

// FIFA code → ISO 3166-1 numeric (world-atlas feature IDs)
const FIFA_TO_NUM: Record<string, number> = {
  MEX: 484, RSA: 710, KOR: 410, CZE: 203,
  CAN: 124, BIH: 70,  QAT: 634, SUI: 756,
  BRA: 76,  MAR: 504, HAI: 332, SCO: 826,
  USA: 840, PAR: 600, AUS: 36,  TUR: 792,
  GER: 276, CUW: 531, CIV: 384, ECU: 218,
  NED: 528, JPN: 392, SWE: 752, TUN: 788,
  BEL: 56,  EGY: 818, IRN: 364, NZL: 554,
  ESP: 724, CPV: 132, KSA: 682, URU: 858,
  FRA: 250, SEN: 686, IRQ: 368, NOR: 578,
  ARG: 32,  ALG: 12,  AUT: 40,  JOR: 400,
  POR: 620, COD: 180, UZB: 860, COL: 170,
  ENG: 826, CRO: 191, GHA: 288, PAN: 591,
};

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}
function lerpColor(
  c1: [number, number, number],
  c2: [number, number, number],
  t: number
): string {
  return `rgb(${lerp(c1[0], c2[0], t)},${lerp(c1[1], c2[1], t)},${lerp(c1[2], c2[2], t)})`;
}

const C_DARK: [number, number, number] = [22, 80, 45];    // dark green
const C_MID:  [number, number, number] = [22, 163, 74];   // #16a34a primary
const C_HIGH: [number, number, number] = [251, 191, 36];  // #fbbf24 accent

function goalColor(goals: number, max: number): string {
  if (goals <= 0 || max === 0) return "#1a2a3a";
  const t = Math.min(goals / max, 1);
  if (t <= 0.5) return lerpColor(C_DARK, C_MID, t * 2);
  return lerpColor(C_MID, C_HIGH, (t - 0.5) * 2);
}

type HoveredInfo = { teams: TeamGoalData[]; x: number; y: number };

export function GoalMap({ teams }: { teams: TeamGoalData[] }) {
  const [hovered, setHovered] = useState<HoveredInfo | null>(null);

  // ISO numeric → teams (826 = UK contains both ENG and SCO)
  const numToTeams: Record<number, TeamGoalData[]> = {};
  for (const t of teams) {
    const num = FIFA_TO_NUM[t.code];
    if (num == null) continue;
    if (!numToTeams[num]) numToTeams[num] = [];
    numToTeams[num].push(t);
  }

  const max = Math.max(...teams.map((t) => t.avgGoals), 1);

  function colorForNum(num: number): string {
    const ts = numToTeams[num];
    if (!ts) return "#1a2a3a";
    const avg = ts.reduce((s, t) => s + t.avgGoals, 0) / ts.length;
    return goalColor(avg, max);
  }

  // Legend stops
  const stops = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    t,
    color: goalColor(t * max, max),
    label: (t * max).toFixed(1),
  }));

  return (
    <div className="relative">
      {/* Map */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 130, center: [10, 20] }}
          style={{ width: "100%", height: "auto" }}
          viewBox="0 0 800 500"
        >
          <ZoomableGroup>
            <Geographies geography="/world-110m.json">
              {({ geographies }) =>
                geographies.map((geo) => {
                  const num = Number(geo.id);
                  const fill = colorForNum(num);
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={fill}
                      stroke="#0b1220"
                      strokeWidth={0.4}
                      style={{
                        default: { outline: "none" },
                        hover: { outline: "none", fill: numToTeams[num] ? "#e8eef7" : fill, opacity: 0.9 },
                        pressed: { outline: "none" },
                      }}
                      onMouseEnter={(e) => {
                        const ts = numToTeams[num];
                        if (!ts) return;
                        const rect = (e.target as SVGElement)
                          .closest("svg")!
                          .getBoundingClientRect();
                        setHovered({
                          teams: ts,
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top,
                        });
                      }}
                      onMouseMove={(e) => {
                        if (!hovered) return;
                        const rect = (e.target as SVGElement)
                          .closest("svg")!
                          .getBoundingClientRect();
                        setHovered((prev) =>
                          prev
                            ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top }
                            : null
                        );
                      }}
                      onMouseLeave={() => setHovered(null)}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>

        {/* Tooltip */}
        {hovered && (
          <div
            className="pointer-events-none absolute z-10 rounded-xl border border-border bg-surface-2 px-3 py-2 shadow-2xl"
            style={{
              left: Math.min(hovered.x + 10, 650),
              top: Math.max(hovered.y - 60, 8),
            }}
          >
            {hovered.teams.map((t) => (
              <div key={t.code} className="flex items-center gap-2 text-sm">
                <span className="text-base">{t.flag}</span>
                <span className="font-semibold text-foreground">{t.name}</span>
                <span className="ml-2 tabular-nums text-accent font-bold">
                  {t.avgGoals.toFixed(2)}
                </span>
                <span className="text-muted text-xs">goles/partido</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-3">
        <span className="text-xs text-muted">Menos goles</span>
        <div className="flex h-3 flex-1 overflow-hidden rounded-full">
          {stops.map((s, i) =>
            i < stops.length - 1 ? (
              <div
                key={i}
                className="flex-1"
                style={{
                  background: `linear-gradient(to right, ${s.color}, ${stops[i + 1].color})`,
                }}
              />
            ) : null
          )}
        </div>
        <span className="text-xs text-muted">Más goles</span>
        <span className="text-xs text-accent font-bold tabular-nums">
          máx {max.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

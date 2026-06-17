"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { RankEvolution } from "@/lib/stats";

// Paleta tenue para el resto de participantes (la línea propia va en verde).
const PALETTE = [
  "#60a5fa", "#f472b6", "#fbbf24", "#a78bfa", "#34d399",
  "#fb923c", "#22d3ee", "#e879f9", "#facc15", "#4ade80",
  "#f87171", "#38bdf8",
];

export function RankEvolutionChart({
  data,
  currentUserId,
}: {
  data: RankEvolution;
  currentUserId: string;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const chartData = useMemo(
    () =>
      data.matchLabels.map((label, i) => {
        const row: Record<string, number | string> = { label, idx: i + 1 };
        for (const s of data.series) row[s.userId] = s.positions[i];
        return row;
      }),
    [data]
  );

  if (data.matchLabels.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface p-6 text-center text-muted">
        Aún no hay partidos jugados. La evolución aparecerá cuando empiecen los resultados.
      </p>
    );
  }

  const n = data.series.length;

  function toggle(userId: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  const colorFor = (userId: string, i: number) =>
    userId === currentUserId ? "#16a34a" : PALETTE[i % PALETTE.length];

  return (
    <div>
      <div className="rounded-2xl border border-border bg-surface p-2 sm:p-4">
        <ResponsiveContainer width="100%" height={460}>
          <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: -12 }}>
            <CartesianGrid stroke="#25344f" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#8a9bb5", fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              reversed
              domain={[1, n]}
              allowDecimals={false}
              tick={{ fill: "#8a9bb5", fontSize: 11 }}
              width={32}
            />
            <Tooltip
              contentStyle={{
                background: "#18243a",
                border: "1px solid #25344f",
                borderRadius: 12,
                fontSize: 12,
              }}
              itemSorter={(item) => Number(item.value)}
              formatter={(value, _name, item) => [
                `#${value}`,
                data.series.find((s) => s.userId === item.dataKey)?.name ?? "",
              ]}
            />
            {data.series.map((s, i) => {
              if (hidden.has(s.userId)) return null;
              const isMe = s.userId === currentUserId;
              return (
                <Line
                  key={s.userId}
                  type="monotone"
                  dataKey={s.userId}
                  name={s.name}
                  stroke={colorFor(s.userId, i)}
                  strokeWidth={isMe ? 3.5 : 1.4}
                  strokeOpacity={isMe ? 1 : 0.5}
                  dot={false}
                  activeDot={{ r: isMe ? 5 : 3 }}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda con toggle (clic para ocultar/mostrar) */}
      <div className="mt-3 flex flex-wrap gap-2">
        {data.series.map((s, i) => {
          const isMe = s.userId === currentUserId;
          const off = hidden.has(s.userId);
          return (
            <button
              key={s.userId}
              type="button"
              onClick={() => toggle(s.userId)}
              className={`chip flex items-center gap-1.5 transition ${
                off ? "opacity-40" : ""
              } ${isMe ? "border-primary text-green-200" : ""}`}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: colorFor(s.userId, i) }}
              />
              <span className={isMe ? "font-bold" : ""}>{s.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

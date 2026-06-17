"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ConfederationRow } from "@/lib/stats";

const COLORS = {
  win: "#16a34a", // primary (verde)
  draw: "#fbbf24", // accent (ámbar)
  loss: "#ef4444", // danger (rojo)
};

export function ConfederationChart({ data }: { data: ConfederationRow[] }) {
  const hasData = data.some((r) => r.win + r.draw + r.loss > 0);
  if (!hasData) {
    return (
      <p className="rounded-xl border border-border bg-surface p-6 text-center text-muted">
        Todavía no hay datos para mostrar.
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-2 sm:p-4">
      <ResponsiveContainer width="100%" height={420}>
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: -12 }}>
          <CartesianGrid stroke="#25344f" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="conf" tick={{ fill: "#8a9bb5", fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fill: "#8a9bb5", fontSize: 11 }} width={36} />
          <Tooltip
            cursor={{ fill: "#ffffff10" }}
            contentStyle={{
              background: "#18243a",
              border: "1px solid #25344f",
              borderRadius: 12,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="win" name="Victorias" fill={COLORS.win} radius={[3, 3, 0, 0]} />
          <Bar dataKey="draw" name="Empates" fill={COLORS.draw} radius={[3, 3, 0, 0]} />
          <Bar dataKey="loss" name="Derrotas" fill={COLORS.loss} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

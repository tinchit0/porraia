"use client";

import { useEffect, useState } from "react";

function diff(target: number) {
  const ms = Math.max(0, target - Date.now());
  const s = Math.floor(ms / 1000);
  return {
    done: ms === 0,
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

function Box({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="min-w-14 rounded-lg bg-surface-2 px-3 py-2 text-center text-2xl font-extrabold tabular-nums">
        {String(value).padStart(2, "0")}
      </span>
      <span className="mt-1 text-xs uppercase tracking-wide text-muted">{label}</span>
    </div>
  );
}

export function Countdown({ lockAtISO }: { lockAtISO: string }) {
  const target = new Date(lockAtISO).getTime();
  const [t, setT] = useState<ReturnType<typeof diff> | null>(null);

  useEffect(() => {
    setT(diff(target));
    const id = setInterval(() => setT(diff(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!t) return null;

  if (t.done) {
    return (
      <span className="badge bg-danger/20 text-red-300">
        🔒 Porra bloqueada — el torneo ha comenzado
      </span>
    );
  }

  return (
    <div className="flex items-end gap-2">
      <Box value={t.d} label="días" />
      <Box value={t.h} label="horas" />
      <Box value={t.m} label="min" />
      <Box value={t.s} label="seg" />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

export function KickoffTime({ iso }: { iso: string }) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    setLabel(
      new Date(iso).toLocaleString("es-ES", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  }, [iso]);
  if (!label) return null;
  return <>{label}</>;
}

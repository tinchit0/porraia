"use client";

import { useState } from "react";
import { KickoffTime } from "@/components/KickoffTime";

export type KnockoutPickInfo = {
  userId: string;
  userName: string;
  homeScore: number;
  awayScore: number;
  winnerTeamId: number | null;
};

export type KnockoutTeamSlot = {
  id: number | null;      // null = equipo aún no determinado
  name: string;           // nombre real o placeholder "1ºA"
  flag: string | null;
};

function AdvancerBadge({
  count,
  names,
  isMe,
  side,
}: {
  count: number;
  names: string[];
  isMe: boolean;
  side: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative shrink-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        className={`cursor-default rounded-full border px-1.5 py-0.5 text-xs tabular-nums ${
          isMe
            ? "border-primary bg-primary/20 font-semibold text-green-300"
            : "border-border text-muted"
        }`}
      >
        {count}
      </span>
      {open && (
        <div
          className={`absolute bottom-full z-50 mb-1 min-w-max rounded-lg border border-border bg-surface-2 px-2.5 py-2 shadow-xl ${
            side === "left" ? "left-0" : "right-0"
          }`}
        >
          <p className="mb-1 border-b border-border pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
            Apuestan que pasa
          </p>
          {names.map((n, i) => (
            <p key={i} className="text-xs text-foreground">
              {n}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function KnockoutJornadaCard({
  label,
  kickoffISO,
  home,
  away,
  realHome,
  realAway,
  myPick,
  allPicks,
  currentUserId,
  locked,
}: {
  label: string;
  kickoffISO: string;
  home: KnockoutTeamSlot;
  away: KnockoutTeamSlot;
  realHome: number | null;
  realAway: number | null;
  myPick: KnockoutPickInfo | null;
  allPicks: KnockoutPickInfo[];
  currentUserId: string;
  locked: boolean;
}) {
  const played = realHome != null && realAway != null;

  // ¿Qué equipo avanza según un pick dado?
  // Cuando los equipos reales están definidos usamos winnerTeamId.
  // Si no, usamos comparación de marcador (home > away → lado home, etc.)
  function advancesSide(p: KnockoutPickInfo, side: "home" | "away"): boolean {
    if (home.id != null && away.id != null) {
      const winnerId = p.winnerTeamId;
      if (winnerId == null) return false;
      return side === "home" ? winnerId === home.id : winnerId === away.id;
    }
    if (p.homeScore > p.awayScore) return side === "home";
    if (p.awayScore > p.homeScore) return side === "away";
    // Empate: sin IDs reales no podemos asignar lado
    return false;
  }

  const visible = locked ? allPicks : [];
  const homeAdvancers = visible.filter((p) => advancesSide(p, "home"));
  const awayAdvancers = visible.filter((p) => advancesSide(p, "away"));

  // Los equipos reales están asignados en el partido
  const teamsKnown = home.id != null && away.id != null;

  // El pick del usuario es relevante solo si su winnerTeamId coincide con uno de los equipos reales
  const pickMatchesTeams =
    teamsKnown &&
    myPick != null &&
    myPick.winnerTeamId != null &&
    (myPick.winnerTeamId === home.id || myPick.winnerTeamId === away.id);

  // Verde solo cuando los equipos están definidos (no en placeholders)
  const myAdvancesHome = teamsKnown && myPick ? advancesSide(myPick, "home") : false;
  const myAdvancesAway = teamsKnown && myPick ? advancesSide(myPick, "away") : false;

  return (
    <div className="card flex items-center gap-3 p-3 sm:p-4">
      {/* Columna izquierda: etiqueta + hora */}
      <div className="w-20 shrink-0 text-xs text-muted">
        <div className="font-medium text-foreground/70">{label}</div>
        <div>
          <KickoffTime iso={kickoffISO} />
        </div>
        {locked && allPicks.length > 0 && (
          <div className="mt-0.5 text-[10px] text-muted/60">👥 {allPicks.length}</div>
        )}
      </div>

      {/* Centro: equipos + marcador */}
      <div className="flex flex-1 items-center justify-center gap-2">
        {/* Equipo local */}
        <div className="flex flex-1 items-center justify-end gap-1.5">
          <span
            className={`truncate text-right text-sm font-medium ${myAdvancesHome ? "text-green-300" : ""}`}
          >
            {home.flag && <span className="mr-0.5">{home.flag}</span>}
            {home.name}
          </span>
          {locked && homeAdvancers.length > 0 && (
            <AdvancerBadge
              count={homeAdvancers.length}
              names={homeAdvancers.map((p) => p.userName)}
              isMe={myAdvancesHome}
              side="left"
            />
          )}
        </div>

        {/* Marcador */}
        <span className="min-w-16 text-center text-lg font-extrabold tabular-nums">
          {played ? `${realHome} - ${realAway}` : "— : —"}
        </span>

        {/* Equipo visitante */}
        <div className="flex flex-1 items-center gap-1.5">
          {locked && awayAdvancers.length > 0 && (
            <AdvancerBadge
              count={awayAdvancers.length}
              names={awayAdvancers.map((p) => p.userName)}
              isMe={myAdvancesAway}
              side="right"
            />
          )}
          <span
            className={`truncate text-sm font-medium ${myAdvancesAway ? "text-green-300" : ""}`}
          >
            {away.flag && <span className="mr-0.5">{away.flag}</span>}
            {away.name}
          </span>
        </div>
      </div>

      {/* Columna derecha: mi pronóstico (solo si los equipos coinciden) */}
      <div className="w-24 shrink-0 text-right text-xs">
        {pickMatchesTeams ? (
          <div className="text-muted">
            Tú: {myPick!.homeScore}-{myPick!.awayScore}
          </div>
        ) : (
          <span className="text-muted/40">—</span>
        )}
      </div>
    </div>
  );
}

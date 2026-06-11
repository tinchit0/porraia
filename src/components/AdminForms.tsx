"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  saveGroupResultsAction,
  type AdminState,
} from "@/app/admin/actions";

export type AdminMatch = {
  id: number;
  group: string;
  matchday: number;
  home: { name: string; flag: string };
  away: { name: string; flag: string };
  homeScore: number | null;
  awayScore: number | null;
};
export type AdminTeam = { id: number; name: string; flag: string };

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-accent px-6">
      {pending ? "Guardando…" : label}
    </button>
  );
}

function Feedback({ state }: { state: AdminState }) {
  if (state?.ok)
    return (
      <p className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm text-green-300">
        ✓ Guardado y clasificación recalculada.
      </p>
    );
  if (state?.error)
    return (
      <p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-red-300">
        {state.error}
      </p>
    );
  return null;
}

export function GroupResultsForm({ matches }: { matches: AdminMatch[] }) {
  const [state, action] = useActionState<AdminState, FormData>(
    saveGroupResultsAction,
    undefined
  );

  const byGroup = matches.reduce<Record<string, AdminMatch[]>>((acc, m) => {
    (acc[m.group] ??= []).push(m);
    return acc;
  }, {});

  return (
    <form action={action} className="space-y-4">
      <Feedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        {Object.entries(byGroup).map(([g, ms]) => (
          <section key={g} className="card p-4">
            <h3 className="mb-2 font-bold">
              <span className="badge bg-primary text-primary-fg">Grupo {g}</span>
            </h3>
            <div className="space-y-1.5">
              {ms.map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-sm">
                  <span className="flex flex-1 items-center justify-end gap-1 truncate text-right">
                    <span className="truncate">{m.home.name}</span> {m.home.flag}
                  </span>
                  <input
                    type="number"
                    name={`m_${m.id}_home`}
                    defaultValue={m.homeScore ?? ""}
                    min={0}
                    max={99}
                    className="h-9 w-11 rounded-md border border-border bg-background text-center font-bold outline-none focus:border-primary"
                  />
                  <span className="text-muted">-</span>
                  <input
                    type="number"
                    name={`m_${m.id}_away`}
                    defaultValue={m.awayScore ?? ""}
                    min={0}
                    max={99}
                    className="h-9 w-11 rounded-md border border-border bg-background text-center font-bold outline-none focus:border-primary"
                  />
                  <span className="flex flex-1 items-center gap-1 truncate">
                    {m.away.flag} <span className="truncate">{m.away.name}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="sticky bottom-4 flex justify-center">
        <SubmitBtn label="💾 Guardar resultados y recalcular" />
      </div>
    </form>
  );
}


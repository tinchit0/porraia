"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  loginAction,
  registerAction,
  type AuthState,
} from "@/lib/actions/auth-actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full">
      {pending ? "Un momento…" : label}
    </button>
  );
}

export function AuthForm({
  mode,
  callbackUrl,
}: {
  mode: "login" | "register";
  callbackUrl?: string;
}) {
  const action = mode === "login" ? loginAction : registerAction;
  const [state, formAction] = useActionState<AuthState, FormData>(
    action,
    undefined
  );

  return (
    <div className="card mx-auto w-full max-w-md p-6 sm:p-8">
      <h1 className="text-2xl font-extrabold">
        {mode === "login" ? "Entrar" : "Crear cuenta"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {mode === "login"
          ? "Accede para editar tu porra y ver la clasificación."
          : "Regístrate con tu correo para empezar a jugar."}
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        {mode === "register" && (
          <div>
            <label className="label" htmlFor="name">
              Nombre
            </label>
            <input id="name" name="name" className="input" placeholder="Tu nombre" required />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">
            Correo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="input"
            placeholder="tu@correo.com"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="input"
            placeholder="••••••••"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
        </div>

        {mode === "login" && (
          <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/porra"} />
        )}

        {state?.error && (
          <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-red-300">
            {state.error}
          </p>
        )}

        <SubmitButton label={mode === "login" ? "Entrar" : "Crear cuenta"} />
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {mode === "login" ? (
          <>
            ¿No tienes cuenta?{" "}
            <Link href="/registro" className="font-semibold text-accent hover:underline">
              Regístrate
            </Link>
          </>
        ) : (
          <>
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="font-semibold text-accent hover:underline">
              Entra
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

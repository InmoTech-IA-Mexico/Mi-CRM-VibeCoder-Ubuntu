"use client";

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";

// Sesión autenticada (JUA-6). El token opaco se guarda en localStorage; la
// sesión se resuelve contra Convex (`auth.sesionActual`) y expira a las 8 h.

const CLAVE_TOKEN = "sesion.token";

export function leerToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CLAVE_TOKEN);
}
export function guardarToken(token: string) {
  window.localStorage.setItem(CLAVE_TOKEN, token);
}
export function borrarToken() {
  window.localStorage.removeItem(CLAVE_TOKEN);
}

type DatosSesion = NonNullable<FunctionReturnType<typeof api.auth.sesionActual>>;
export type Sesion = DatosSesion & { token: string; cerrarSesion: () => Promise<void> };

export const SessionContext = createContext<Sesion | null>(null);

function Cargando() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-8 text-sm text-muted">
      Cargando…
    </div>
  );
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [token] = useState<string | null>(() => leerToken());
  const cerrarSesionMut = useMutation(api.auth.cerrarSesion);
  const tocarSesion = useMutation(api.auth.tocarSesion);

  // La expiración se valida con el tiempo del servidor (JUA-10), no del cliente.
  const datos = useQuery(api.auth.sesionActual, token ? { token } : "skip");

  // Sin token, o sesión inválida/expirada → al login.
  useEffect(() => {
    if (!token) {
      router.replace("/login");
    } else if (datos === null) {
      borrarToken();
      router.replace("/login?expirada=1");
    }
  }, [token, datos, router]);

  // Extiende la sesión (expiración deslizante) al entrar.
  useEffect(() => {
    if (token && datos) void tocarSesion({ token });
  }, [token, datos, tocarSesion]);

  const cerrarSesion = useCallback(async () => {
    try {
      if (token) await cerrarSesionMut({ token });
    } finally {
      // Aunque falle el borrado en servidor, cerramos la sesión en el cliente.
      borrarToken();
      router.replace("/login");
    }
  }, [token, cerrarSesionMut, router]);

  const valor = useMemo<Sesion | null>(
    () => (token && datos ? { ...datos, token, cerrarSesion } : null),
    [token, datos, cerrarSesion],
  );

  // `undefined` (cargando/skip) y `null` (redirigiendo) renderizan lo mismo en
  // servidor y en el primer render cliente → sin desajuste de hidratación.
  if (!valor) return <Cargando />;

  return <SessionContext.Provider value={valor}>{children}</SessionContext.Provider>;
}

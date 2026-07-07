"use client";

import { useContext } from "react";
import { SessionContext, type Sesion } from "./session-provider";

/** Acceso a la sesión actual (negocio + usuario + rol). */
export function useSesion(): Sesion {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSesion debe usarse dentro de <SessionProvider>");
  }
  return ctx;
}

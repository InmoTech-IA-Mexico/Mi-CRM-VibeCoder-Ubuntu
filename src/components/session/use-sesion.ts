"use client";

import { useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SessionContext, type Sesion } from "./session-provider";

/** Acceso a la sesión actual (negocio + usuario + rol). */
export function useSesion(): Sesion {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSesion debe usarse dentro de <SessionProvider>");
  }
  return ctx;
}

/**
 * `true` si el rol puede MODIFICAR datos (admin u operativo). El rol observador
 * (solo lectura, JUA-42) es `false`: la UI oculta sus botones de acción. La
 * seguridad real vive en el servidor (`resolverSesionEscritura`); esto es solo
 * para no mostrar acciones que fallarían.
 */
export function usePuedeEditar(): boolean {
  return useSesion().rol !== "observador";
}

/**
 * Guard de ruta para pantallas de creación/edición (JUA-42): si el usuario es
 * observador, lo redirige a Inicio. Devuelve `false` mientras redirige para que
 * la pantalla renderice `null` y no muestre el formulario un instante.
 */
export function useGuardEscritura(): boolean {
  const router = useRouter();
  const puedeEditar = usePuedeEditar();
  useEffect(() => {
    if (!puedeEditar) router.replace("/inicio");
  }, [puedeEditar, router]);
  return puedeEditar;
}

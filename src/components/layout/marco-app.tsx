"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { BotonFlotante } from "./boton-flotante";
import { BannerSinConexion } from "./banner-sin-conexion";
import { usePuedeEditar } from "@/components/session/use-sesion";

// Pantallas de nivel superior con barra inferior (se puede navegar entre ellas).
// El FAB "nuevo cliente" solo aparece donde tiene sentido (Inicio/Clientes). Las
// pantallas de detalle/formulario (ficha, nuevo, editar…) no llevan ni barra ni
// FAB: tienen su propio "volver" y ocupan toda la altura (fiel al diseño).
const RUTAS_NAV = ["/inicio", "/clientes", "/ventas"];
// El FAB da de alta cliente (Inicio/Clientes) o venta (Ventas, JUA-111). La acción
// concreta la elige BotonFlotante según la ruta.
const RUTAS_FAB = ["/inicio", "/clientes", "/ventas"];

export function MarcoApp({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const puedeEditar = usePuedeEditar();
  const conNav = RUTAS_NAV.includes(pathname);
  // El FAB crea registros → oculto para el observador (solo lectura, JUA-42).
  const conFab = RUTAS_FAB.includes(pathname) && puedeEditar;

  return (
    <>
      <BannerSinConexion />
      <main className={conNav ? "flex-1 pb-24" : "flex-1"}>{children}</main>
      {conFab && <BotonFlotante />}
      {conNav && <BottomNav />}
    </>
  );
}

"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { BotonFlotante } from "./boton-flotante";

// Pantallas de nivel superior con barra inferior (se puede navegar entre ellas).
// El FAB "nuevo cliente" solo aparece donde tiene sentido (Inicio/Clientes). Las
// pantallas de detalle/formulario (ficha, nuevo, editar…) no llevan ni barra ni
// FAB: tienen su propio "volver" y ocupan toda la altura (fiel al diseño).
const RUTAS_NAV = ["/inicio", "/clientes", "/ventas"];
const RUTAS_FAB = ["/inicio", "/clientes"];

export function MarcoApp({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const conNav = RUTAS_NAV.includes(pathname);
  const conFab = RUTAS_FAB.includes(pathname);

  return (
    <>
      <main className={conNav ? "flex-1 pb-24" : "flex-1"}>{children}</main>
      {conFab && <BotonFlotante />}
      {conNav && <BottomNav />}
    </>
  );
}

"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { BotonFlotante } from "./boton-flotante";

// Las pestañas principales (Inicio/Clientes) llevan barra inferior + FAB. Las
// pantallas de detalle/formulario (ficha, nuevo, editar…) NO: tienen su propio
// botón "volver" y ocupan toda la altura, fiel al diseño de referencia.
const RUTAS_TAB = ["/inicio", "/clientes"];

export function MarcoApp({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const esTab = RUTAS_TAB.includes(pathname);

  return (
    <>
      <main className={esTab ? "flex-1 pb-24" : "flex-1"}>{children}</main>
      {esTab && (
        <>
          <BotonFlotante />
          <BottomNav />
        </>
      )}
    </>
  );
}

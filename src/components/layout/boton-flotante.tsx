"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, TrendingUp, CalendarPlus } from "lucide-react";

// FAB flotando sobre la barra inferior (alineado al contenedor centrado de 430px).
// La acción depende de la pantalla: en Ventas da de alta una venta con selector de
// cliente (JUA-111); en Inicio programa un seguimiento (JUA-119); en el resto, un
// cliente nuevo.
const ACCION_VENTAS = { href: "/ventas/nueva", label: "Nueva venta", icon: TrendingUp };
const ACCION_SEGUIMIENTO = { href: "/seguimientos/nuevo", label: "Programar seguimiento", icon: CalendarPlus };
const ACCION_CLIENTE = { href: "/clientes/nuevo", label: "Nuevo cliente", icon: Plus };

export function BotonFlotante() {
  const pathname = usePathname();
  const { href, label, icon: Icon } =
    pathname === "/ventas" ? ACCION_VENTAS : pathname === "/inicio" ? ACCION_SEGUIMIENTO : ACCION_CLIENTE;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px]">
      <Link
        href={href}
        aria-label={label}
        className="pointer-events-auto absolute bottom-[calc(84px+env(safe-area-inset-bottom))] right-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-gold-500 to-gold-600 text-white shadow-[0_8px_20px_rgba(201,162,94,0.45)] transition-transform active:scale-95"
      >
        <Icon size={26} strokeWidth={2.4} />
      </Link>
    </div>
  );
}

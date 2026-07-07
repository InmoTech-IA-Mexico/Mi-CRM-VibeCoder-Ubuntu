import Link from "next/link";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../../convex/_generated/api";
import { IndicadorPrioridad, bordePrioridadClase } from "@/components/ui/indicador-prioridad";
import { BadgeEstado } from "@/components/ui/badge-estado";
import { colorUrgenciaDias } from "@/lib/fechas";
import { cn } from "@/lib/utils";

export type ItemInactividad = FunctionReturnType<typeof api.inicio.panelInactividad>[number];

// Fondos de avatar rotativos (handoff de diseño).
const AVATAR = [
  "bg-[#F4ECDB] text-[#9A7327]",
  "bg-[#E2EDEE] text-[#1C4E55]",
  "bg-[#E8ECE2] text-[#586353]",
  "bg-[#F0ECE2] text-[#6B7268]",
];

export function TarjetaClienteInactivo({
  item,
  indice,
}: {
  item: ItemInactividad;
  indice: number;
}) {
  const inicial = item.nombre.charAt(0).toUpperCase();

  return (
    <Link
      href={`/clientes/${item._id}`}
      className={cn(
        "flex items-center gap-3 rounded-card border border-l-[3px] border-neutral-100 bg-surface p-3.5 shadow-sm",
        bordePrioridadClase(item.prioridad),
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-serif text-base font-semibold",
          AVATAR[indice % AVATAR.length],
        )}
      >
        {inicial}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-ink">{item.nombre}</p>
        <div className="mt-1 flex items-center gap-2">
          {item.prioridad && <IndicadorPrioridad prioridad={item.prioridad} />}
          <span className={cn("text-[12px] font-semibold", colorUrgenciaDias(item.diasSinContacto))}>
            Hace {item.diasSinContacto} días
          </span>
        </div>
      </div>
      <BadgeEstado estado={item.estado} />
    </Link>
  );
}

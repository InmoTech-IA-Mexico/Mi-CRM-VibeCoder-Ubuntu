import Link from "next/link";
import type { ReactNode } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../../convex/_generated/api";
import { BadgeEstado } from "@/components/ui/badge-estado";
import { bordePrioridadClase } from "@/components/ui/indicador-prioridad";
import { diasDesde } from "@/lib/fechas";
import { LABELS, type EtapaPipeline } from "@/lib/enums";
import { cn } from "@/lib/utils";

export type ItemCliente = FunctionReturnType<typeof api.clientes.listar>[number];

// Color del punto de la etapa de venta (handoff).
const COLOR_ETAPA: Record<EtapaPipeline, string> = {
  nueva: "bg-[#80847B]",
  en_contacto: "bg-[#2E6E78]",
  propuesta: "bg-[#0E2E34]",
  negociacion: "bg-[#C9A25E]",
  ganada: "bg-success",
  perdida: "bg-danger",
  cancelada: "bg-neutral-400",
};

/** Resalta la parte del nombre que coincide con la búsqueda. */
function resaltar(nombre: string, q: string): ReactNode {
  const query = q.trim();
  if (!query) return nombre;
  const i = nombre.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return nombre;
  return (
    <>
      {nombre.slice(0, i)}
      <span className="rounded-[3px] bg-gold-tint px-0.5">{nombre.slice(i, i + query.length)}</span>
      {nombre.slice(i + query.length)}
    </>
  );
}

export function TarjetaCliente({
  item,
  busqueda,
  ahora,
}: {
  item: ItemCliente;
  busqueda: string;
  ahora: number;
}) {
  const dias = diasDesde(item.ultimaInteraccion, ahora);
  const colorDias = dias <= 14 ? "text-success" : dias <= 18 ? "text-gold-700" : "text-danger";

  return (
    <Link
      href={`/clientes/${item._id}`}
      className={cn(
        "block rounded-card border border-l-[3px] border-neutral-100 bg-surface px-4 py-3 shadow-sm",
        bordePrioridadClase(item.prioridad),
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[15px] font-semibold text-ink">
          {resaltar(item.nombre, busqueda)}
        </span>
        <BadgeEstado estado={item.estado} />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className={cn("text-[12.5px] font-semibold", colorDias)}>Hace {dias} días</span>
        {item.etapa && (
          <span className="flex flex-shrink-0 items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", COLOR_ETAPA[item.etapa])} />
            <span className="text-[12px] text-body">{LABELS.etapa[item.etapa]}</span>
          </span>
        )}
      </div>
    </Link>
  );
}

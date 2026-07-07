"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Check } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { useSesion } from "@/components/session/use-sesion";
import { IndicadorPrioridad, bordePrioridadClase } from "@/components/ui/indicador-prioridad";
import { cn } from "@/lib/utils";

export type ItemAgenda = FunctionReturnType<typeof api.inicio.agendaDelDia>[number];

export function TarjetaRecordatorio({ item }: { item: ItemAgenda }) {
  const { token } = useSesion();
  const marcarRealizado = useMutation(api.inicio.marcarSeguimientoRealizado);
  const [marcando, setMarcando] = useState(false);

  const completar = async () => {
    if (marcando) return;
    setMarcando(true);
    try {
      await marcarRealizado({ token, seguimientoId: item._id });
    } catch (error) {
      console.error("No se pudo marcar el seguimiento como realizado", error);
    } finally {
      setMarcando(false);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-card border border-l-[3px] border-neutral-100 bg-surface p-3.5 shadow-sm",
        bordePrioridadClase(item.prioridad),
      )}
    >
      <Link
        href={item.clienteId ? `/clientes/${item.clienteId}` : "#"}
        className="min-w-0 flex-1"
      >
        <div className="flex items-center gap-2">
          {item.hora && (
            <span className="text-[12.5px] font-semibold tabular-nums text-muted">
              {item.hora}
            </span>
          )}
          {item.vencido && (
            <span className="flex items-center gap-1 rounded-lg bg-[#F6E7E0] px-2 py-0.5">
              <span className="h-[5px] w-[5px] rounded-full bg-danger" />
              <span className="text-[10.5px] font-semibold text-[#8A3F2C]">Vencido</span>
            </span>
          )}
        </div>
        <p className="mt-1.5 break-words text-[15px] font-semibold text-ink">
          {item.titulo}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="min-w-0 break-words text-[12.5px] text-muted">
            {item.clienteNombre}
          </span>
          <IndicadorPrioridad prioridad={item.prioridad} />
        </div>
      </Link>

      {/* TODO(JUA-24): añadir reprogramar/cancelar en el flujo avanzado. */}
      <button
        type="button"
        aria-label="Marcar como realizado"
        aria-busy={marcando}
        disabled={marcando}
        onClick={completar}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[#2E7D6B]/30 bg-[#E2EFEB] transition-transform active:scale-95 disabled:cursor-wait disabled:opacity-60"
      >
        <Check size={18} strokeWidth={2.2} className="text-success" />
      </button>
    </div>
  );
}

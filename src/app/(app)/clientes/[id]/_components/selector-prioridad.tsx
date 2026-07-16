"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Check, ChevronDown, AlertCircle } from "lucide-react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { useSesion, usePuedeEditar } from "@/components/session/use-sesion";
import { HojaInferior } from "@/components/ui/hoja-inferior";
import { PRIORIDAD_ESTILO } from "@/components/ui/indicador-prioridad";
import { BadgePrioridad } from "@/components/ui/indicador-prioridad";
import { LABELS, type Prioridad } from "@/lib/enums";
import { cn } from "@/lib/utils";

// Prioridad ESTRATÉGICA del cliente (JUA-46), editable inline desde la ficha.
// Distinta de la prioridad de un seguimiento (esa indica urgencia de una tarea).
// Ambos roles pueden cambiarla; se guarda al instante. Estilos: fuente única en
// indicador-prioridad (PRIORIDAD_ESTILO).
const OPCIONES: (Prioridad | null)[] = ["alta", "media", "baja", null];

export function SelectorPrioridadCliente({
  clienteId,
  prioridad,
}: {
  clienteId: Id<"clientes">;
  prioridad: Prioridad | null;
}) {
  const { token } = useSesion();
  const puedeEditar = usePuedeEditar();
  const cambiar = useMutation(api.clientes.cambiarPrioridad);
  const [abierta, setAbierta] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Observador (JUA-42): muestra la prioridad en solo lectura, sin el selector.
  if (!puedeEditar) {
    return prioridad ? (
      <BadgePrioridad prioridad={prioridad} />
    ) : (
      <span className="text-[12px] font-semibold text-muted">Sin prioridad</span>
    );
  }

  const elegir = async (nueva: Prioridad | null) => {
    if (ocupado) return;
    if (nueva === prioridad) return setAbierta(false);
    setOcupado(true);
    setError(null);
    try {
      await cambiar({ token, clienteId, prioridad: nueva });
      setAbierta(false);
    } catch (e) {
      console.error("No se pudo cambiar la prioridad del cliente", e);
      setError("No se pudo cambiar la prioridad. Inténtalo de nuevo.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="Cambiar prioridad del cliente"
        aria-haspopup="dialog"
        aria-busy={ocupado}
        disabled={ocupado}
        onClick={() => {
          setError(null);
          setAbierta(true);
        }}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition active:scale-95 disabled:opacity-60",
          prioridad ? PRIORIDAD_ESTILO[prioridad].fondo : "border border-dashed border-border-input bg-surface",
        )}
      >
        {prioridad ? (
          <>
            <span className={cn("h-1.5 w-1.5 rounded-full", PRIORIDAD_ESTILO[prioridad].punto)} />
            <span className={cn("text-[12px] font-semibold", PRIORIDAD_ESTILO[prioridad].texto)}>
              {LABELS.prioridad[prioridad]}
            </span>
          </>
        ) : (
          <span className="text-[12px] font-semibold text-muted">Asignar prioridad</span>
        )}
        <ChevronDown size={12} strokeWidth={2.2} className={prioridad ? PRIORIDAD_ESTILO[prioridad].texto : "text-muted"} />
      </button>

      <HojaInferior
        abierta={abierta}
        onCerrar={() => setAbierta(false)}
        titulo={
          <div>
            <p className="font-serif text-lg font-semibold text-ink">Prioridad del cliente</p>
            <p className="mt-1 text-[13px] leading-snug text-body">
              Su importancia estratégica (distinta de la urgencia de un seguimiento).
            </p>
          </div>
        }
      >
        <div className="flex flex-col gap-2 pt-1">
          {OPCIONES.map((op) => {
            const activo = op === prioridad;
            return (
              <button
                key={op ?? "ninguna"}
                type="button"
                disabled={ocupado}
                onClick={() => elegir(op)}
                className={cn(
                  "flex items-center gap-3 rounded-[14px] border p-3.5 text-left transition active:scale-[0.99] disabled:opacity-60",
                  activo ? "border-[1.5px] border-gold-500 bg-gold-tint" : "border-border-input bg-surface",
                )}
              >
                <span className={cn("h-2.5 w-2.5 rounded-full", op ? PRIORIDAD_ESTILO[op].punto : "bg-neutral-300")} />
                <span className="flex-1 text-[15px] font-medium text-ink">
                  {op ? LABELS.prioridad[op] : "Sin prioridad"}
                </span>
                {activo && <Check size={18} strokeWidth={2.4} className="text-gold-700" />}
              </button>
            );
          })}

          {error && (
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-danger/30 bg-[#F9ECE7] px-3 py-2.5">
              <AlertCircle size={16} strokeWidth={1.9} className="flex-shrink-0 text-danger" />
              <p className="text-[12.5px] font-medium text-[#8A3F2C]">{error}</p>
            </div>
          )}
        </div>
      </HojaInferior>
    </>
  );
}

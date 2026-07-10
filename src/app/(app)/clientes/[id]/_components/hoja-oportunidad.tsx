"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { X, Trash2, AlertCircle, PartyPopper } from "lucide-react";
import { api } from "../../../../../../convex/_generated/api";
import { HojaConfirmar } from "@/components/ui/hoja-confirmar";
import { LABELS, type EtapaPipeline } from "@/lib/enums";
import { cn } from "@/lib/utils";

export type ItemOportunidad = NonNullable<
  FunctionReturnType<typeof api.clientes.detalle>
>["oportunidades"][number];

const ETAPAS: { key: EtapaPipeline; punto: string }[] = [
  { key: "nueva", punto: "bg-[#80847B]" },
  { key: "en_contacto", punto: "bg-[#2E6E78]" },
  { key: "propuesta", punto: "bg-[#0E2E34]" },
  { key: "negociacion", punto: "bg-[#C9A25E]" },
  { key: "ganada", punto: "bg-[#2E7D6B]" },
  { key: "perdida", punto: "bg-[#B0573F]" },
  { key: "cancelada", punto: "bg-[#A7A395]" },
];
const REQUIEREN_MOTIVO: EtapaPipeline[] = ["perdida", "cancelada"];

/** Bottom sheet para cambiar la etapa de una oportunidad (JUA-21). */
export function HojaOportunidad({
  oportunidad,
  token,
  esAdmin,
  onClose,
}: {
  oportunidad: ItemOportunidad;
  token: string;
  esAdmin: boolean;
  onClose: () => void;
}) {
  const [etapa, setEtapa] = useState<EtapaPipeline>(oportunidad.etapa);
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const cambiarEtapa = useMutation(api.oportunidades.cambiarEtapa);
  const eliminar = useMutation(api.oportunidades.eliminar);

  const requiereMotivo = REQUIEREN_MOTIVO.includes(etapa);
  const esGanada = etapa === "ganada";
  const cambiado = etapa !== oportunidad.etapa;
  const puedeGuardar = cambiado && (!requiereMotivo || motivo.trim().length > 0);

  // Categoría del motivo por etapa: perdida/cancelada (motivoPerdida) comparten
  // texto; ganada (motivoCierre) es otro campo; las abiertas no llevan motivo. Al
  // cruzar de categoría se limpia el texto para no reutilizarlo entre campos
  // distintos (p. ej. un motivo de pérdida que acabaría como nota de cierre).
  const categoriaMotivo = (e: EtapaPipeline) =>
    REQUIEREN_MOTIVO.includes(e) ? "perdida" : e === "ganada" ? "ganada" : "abierta";
  const elegirEtapa = (nueva: EtapaPipeline) => {
    if (categoriaMotivo(nueva) !== categoriaMotivo(etapa)) setMotivo("");
    setEtapa(nueva);
  };

  const guardar = async () => {
    if (guardando || !puedeGuardar) return;
    setGuardando(true);
    setError(null);
    try {
      await cambiarEtapa({
        token,
        oportunidadId: oportunidad._id,
        // El motivo aplica a perdida/cancelada (obligatorio) y a ganada (notas de
        // cierre, opcional). En etapas abiertas no se envía.
        motivo: requiereMotivo || esGanada ? motivo : undefined,
        etapa,
      });
      onClose();
    } catch (e) {
      console.error("No se pudo cambiar la etapa", e);
      setError("No se pudo cambiar la etapa. Inténtalo de nuevo.");
      setGuardando(false);
    }
  };

  const hacerEliminar = async () => {
    if (guardando) return;
    setGuardando(true);
    setError(null);
    try {
      await eliminar({ token, oportunidadId: oportunidad._id });
      onClose();
    } catch (e) {
      console.error("No se pudo eliminar la oportunidad", e);
      // Mantener abierta la hoja de confirmación con el error visible dentro.
      setError("No se pudo eliminar la oportunidad.");
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 cursor-default bg-[rgba(11,37,42,0.45)]" />
      <div className="relative w-full rounded-t-[24px] border-t border-neutral-100 bg-surface p-5 pb-8 shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-neutral-200" />
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-serif text-[18px] font-semibold text-ink">{oportunidad.nombre}</p>
            <p className="mt-0.5 text-[12.5px] text-muted">Cambiar etapa del pipeline</p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-neutral-50 text-body">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {ETAPAS.map(({ key, punto }) => {
            const activo = etapa === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => elegirEtapa(key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-pill border px-3.5 py-2 text-[13px] font-medium transition active:scale-95",
                  activo ? "border-gold-500 bg-gold-tint text-gold-700" : "border-border-input bg-surface text-body",
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", punto)} />
                {LABELS.etapa[key]}
              </button>
            );
          })}
        </div>

        {requiereMotivo && (
          <div className="mt-4">
            <p className="mb-2 text-[13px] font-medium text-ink">
              Motivo <span className="text-danger">*</span>
              <span className="ml-1 font-normal text-muted">({LABELS.etapa[etapa].toLowerCase()})</span>
            </p>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="¿Por qué se marca así?"
              aria-label="Motivo"
              rows={2}
              autoFocus
              className="w-full resize-none rounded-xl border border-border-input bg-surface p-3 text-[14px] text-ink outline-none transition placeholder:text-muted focus:border-gold-500 focus:ring-[3px] focus:ring-gold-500/[0.18]"
            />
          </div>
        )}

        {/* Ganada (JUA-122): celebración + notas de cierre opcionales. */}
        {esGanada && (
          <div className="mt-4">
            <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-[#2E7D6B]/25 bg-[#E2EFEB] px-3.5 py-3">
              <PartyPopper size={20} strokeWidth={1.8} className="flex-shrink-0 text-success" />
              <p className="text-[13px] font-semibold text-[#2E6E5E]">¡Venta ganada! Registra qué fue clave para cerrarla.</p>
            </div>
            <p className="mb-2 text-[13px] font-medium text-ink">
              Motivo / notas de cierre <span className="font-normal text-muted">(opcional)</span>
            </p>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="¿Qué fue clave para cerrar esta venta?"
              aria-label="Notas de cierre"
              rows={2}
              className="w-full resize-none rounded-xl border border-border-input bg-surface p-3 text-[14px] text-ink outline-none transition placeholder:text-muted focus:border-gold-500 focus:ring-[3px] focus:ring-gold-500/[0.18]"
            />
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-danger/30 bg-[#F9ECE7] px-3 py-2.5">
            <AlertCircle size={16} strokeWidth={1.9} className="flex-shrink-0 text-danger" />
            <p className="text-[12.5px] font-medium text-[#8A3F2C]">{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={guardar}
          disabled={!puedeGuardar || guardando}
          className={cn(
            "mt-5 flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-bold transition active:scale-[0.99]",
            puedeGuardar
              ? "bg-gold-500 text-ink shadow-[0_2px_8px_rgba(201,162,94,0.32)]"
              : "cursor-not-allowed bg-neutral-100 text-muted",
          )}
        >
          {guardando ? "Guardando…" : "Guardar cambio"}
        </button>

        {esAdmin && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setConfirmarEliminar(true);
            }}
            disabled={guardando}
            className="mt-2.5 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-danger active:scale-[0.99] disabled:opacity-60"
          >
            <Trash2 size={16} strokeWidth={1.9} />
            Eliminar oportunidad
          </button>
        )}
      </div>

      <HojaConfirmar
        abierta={confirmarEliminar}
        titulo="Eliminar oportunidad"
        mensaje={`Se eliminará "${oportunidad.nombre}" permanentemente. Esta acción no se puede deshacer.`}
        textoConfirmar="Eliminar"
        tono="danger"
        ocupado={guardando}
        error={error}
        onConfirmar={hacerEliminar}
        onCerrar={() => {
          setConfirmarEliminar(false);
          setError(null);
        }}
      />
    </div>
  );
}

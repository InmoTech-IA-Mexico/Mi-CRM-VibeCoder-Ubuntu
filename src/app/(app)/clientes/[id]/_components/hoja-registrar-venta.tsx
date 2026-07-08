"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { X, Trophy, Info, AlertCircle } from "lucide-react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { useSesion } from "@/components/session/use-sesion";
import { epochDesdeFechaHora } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import type { ItemOportunidad } from "./hoja-oportunidad";

/** Bottom sheet para registrar una venta del cliente (JUA-110). */
export function HojaRegistrarVenta({
  clienteId,
  nombre,
  oportunidades,
  token,
  onClose,
}: {
  clienteId: Id<"clientes">;
  nombre: string;
  oportunidades: ItemOportunidad[];
  token: string;
  onClose: () => void;
}) {
  const { negocio } = useSesion();
  const [oportunidadId, setOportunidadId] = useState<Id<"oportunidades"> | null>(null);
  const [importe, setImporte] = useState("");
  const [fecha, setFecha] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: negocio.zonaHoraria }),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const crear = useMutation(api.ventas.crear);

  const importeNum = Number(importe.replace(/[^\d.]/g, ""));
  const valido = importe.trim().length > 0 && importeNum > 0 && fecha.length > 0;

  const guardar = async () => {
    if (guardando || !valido) return;
    setGuardando(true);
    setError(null);
    try {
      await crear({
        token,
        clienteId,
        oportunidadId: oportunidadId ?? undefined,
        importe: importeNum,
        fecha: epochDesdeFechaHora(fecha, "", negocio.zonaHoraria),
      });
      onClose();
    } catch (e) {
      console.error("No se pudo registrar la venta", e);
      setError("No se pudo registrar la venta. Inténtalo de nuevo.");
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 cursor-default bg-[rgba(11,37,42,0.45)]" />
      <div className="relative w-full rounded-t-[24px] border-t border-neutral-100 bg-surface p-5 pb-8 shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-neutral-200" />
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#E0C795] bg-[#F4ECDB]">
              <Trophy size={22} strokeWidth={1.7} className="text-[#B68E45]" />
            </div>
            <div>
              <p className="font-serif text-[18px] font-semibold text-ink">Registrar venta</p>
              <p className="text-[12.5px] text-muted">Se añadirá al historial de {nombre}</p>
            </div>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-neutral-50 text-body">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Oportunidad (opcional) */}
        {oportunidades.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-[13px] font-medium text-ink">Oportunidad <span className="font-normal text-muted">(opcional)</span></p>
            <div className="flex flex-wrap gap-2">
              {oportunidades.map((o) => {
                const activo = oportunidadId === o._id;
                return (
                  <button
                    key={o._id}
                    type="button"
                    onClick={() => setOportunidadId(activo ? null : o._id)}
                    className={cn(
                      "max-w-full truncate rounded-pill border px-3.5 py-1.5 text-[13px] font-medium transition active:scale-95",
                      activo ? "border-gold-500 bg-gold-tint text-gold-700" : "border-border-input bg-surface text-body",
                    )}
                  >
                    {o.nombre}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Importe + fecha */}
        <div className="flex gap-3">
          <div className="flex-1">
            <p className="mb-2 text-[13px] font-medium text-ink">Importe <span className="text-danger">*</span></p>
            <div className="flex h-12 items-center gap-1.5 rounded-xl border border-border-input px-3 transition focus-within:border-gold-500 focus-within:ring-[3px] focus-within:ring-gold-500/[0.18]">
              <span className="text-[15px] font-semibold text-muted">$</span>
              <input
                autoFocus
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
                placeholder="0"
                inputMode="numeric"
                aria-label="Importe de la venta"
                className="w-full bg-transparent text-[15px] font-semibold tabular-nums text-ink outline-none placeholder:text-muted"
              />
            </div>
          </div>
          <div className="flex-1">
            <p className="mb-2 text-[13px] font-medium text-ink">Fecha</p>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              aria-label="Fecha de la venta"
              className="h-12 w-full rounded-xl border border-border-input bg-surface px-3 text-[14px] text-ink outline-none transition focus:border-gold-500 focus:ring-[3px] focus:ring-gold-500/[0.18]"
            />
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5">
          <Info size={16} strokeWidth={1.8} className="mt-0.5 flex-shrink-0 text-neutral-400" />
          <p className="text-[12.5px] leading-snug text-body">El estado del cliente se mantiene; la venta solo se añade a su historial.</p>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-danger/30 bg-[#F9ECE7] px-3 py-2.5">
            <AlertCircle size={16} strokeWidth={1.9} className="flex-shrink-0 text-danger" />
            <p className="text-[12.5px] font-medium text-[#8A3F2C]">{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={guardar}
          disabled={!valido || guardando}
          className={cn(
            "mt-5 flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-bold transition active:scale-[0.99]",
            valido ? "bg-gold-500 text-ink shadow-[0_2px_8px_rgba(201,162,94,0.32)]" : "cursor-not-allowed bg-neutral-100 text-muted",
          )}
        >
          {guardando ? "Registrando…" : "Registrar venta"}
        </button>
      </div>
    </div>
  );
}

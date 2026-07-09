"use client";

import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Hoja de confirmación reutilizable (bottom sheet) — reemplaza a window.confirm
// para acciones destructivas, con estilo consistente y error visible. z alto
// para poder superponerse a otras hojas (p. ej. dentro de la hoja de oportunidad).
export function HojaConfirmar({
  abierta,
  titulo,
  mensaje,
  textoConfirmar = "Confirmar",
  tono = "normal",
  ocupado = false,
  error = null,
  onConfirmar,
  onCerrar,
}: {
  abierta: boolean;
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  tono?: "normal" | "danger";
  ocupado?: boolean;
  error?: string | null;
  onConfirmar: () => void;
  onCerrar: () => void;
}) {
  if (!abierta) return null;
  return (
    <div className="fixed inset-0 z-[70] mx-auto flex max-w-[430px] items-end">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="absolute inset-0 cursor-default bg-[rgba(11,37,42,0.45)]"
      />
      <div className="relative w-full rounded-t-[24px] border-t border-neutral-100 bg-surface p-5 pb-8 shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-neutral-200" />
        <p className="font-serif text-lg font-semibold text-ink">{titulo}</p>
        <p className="mt-2 text-[14px] leading-relaxed text-body">{mensaje}</p>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-danger/30 bg-[#F9ECE7] px-3 py-2.5">
            <AlertCircle size={16} strokeWidth={1.9} className="flex-shrink-0 text-danger" />
            <p className="text-[12.5px] font-medium text-[#8A3F2C]">{error}</p>
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCerrar}
            disabled={ocupado}
            className="flex h-12 flex-1 items-center justify-center rounded-xl border border-border-input text-[15px] font-semibold text-body transition active:scale-[0.99] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={ocupado}
            className={cn(
              "flex h-12 flex-1 items-center justify-center rounded-xl text-[15px] font-bold transition active:scale-[0.99] disabled:opacity-60",
              tono === "danger" ? "bg-danger text-white" : "bg-gold-500 text-ink shadow-[0_2px_8px_rgba(201,162,94,0.32)]",
            )}
          >
            {ocupado ? "Procesando…" : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { MoreVertical, Check, CalendarClock, XCircle, Trash2, AlertCircle } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useSesion } from "@/components/session/use-sesion";
import { HojaInferior } from "@/components/ui/hoja-inferior";
import { epochDesdeFechaHora } from "@/lib/fechas";
import { cn } from "@/lib/utils";

// Acciones de gestión de un recordatorio (JUA-24): marcar realizado, reprogramar,
// cancelar y eliminar. Solo se renderiza si el usuario puede gestionarlo
// (responsable asignado o admin). El backend valida el permiso igualmente.
// Confirmaciones con hoja propia (no window.confirm) y errores visibles.
type Hoja = "reprogramar" | "cancelar" | "eliminar" | null;

const mensajeError = (e: unknown, fallback: string) => {
  const msg = e instanceof Error ? e.message.replace(/^\[.*?\]\s*/, "") : "";
  return msg && !/Uncaught|Server Error/.test(msg) ? msg : fallback;
};

export function AccionesRecordatorio({
  seguimientoId,
  fecha,
  hora,
  puedeGestionar,
}: {
  seguimientoId: Id<"seguimientos">;
  fecha: number;
  hora: string | null;
  puedeGestionar: boolean;
}) {
  const { token, negocio } = useSesion();
  const marcarRealizado = useMutation(api.inicio.marcarSeguimientoRealizado);
  const reprogramar = useMutation(api.seguimientos.reprogramar);
  const cancelar = useMutation(api.seguimientos.cancelar);
  const eliminar = useMutation(api.seguimientos.eliminar);

  const [menu, setMenu] = useState(false);
  const [hoja, setHoja] = useState<Hoja>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fechaRepro, setFechaRepro] = useState(() =>
    new Date(fecha).toLocaleDateString("en-CA", { timeZone: negocio.zonaHoraria }),
  );
  const [horaRepro, setHoraRepro] = useState(hora ?? "");

  if (!puedeGestionar) return null;

  const abrirHoja = (h: Hoja) => {
    setError(null);
    setMenu(false);
    setHoja(h);
  };

  // Acción directa (marcar realizado): si falla, muestra el error en el menú.
  const marcar = async () => {
    if (ocupado) return;
    setOcupado(true);
    setError(null);
    try {
      await marcarRealizado({ token, seguimientoId });
      setMenu(false);
    } catch (e) {
      console.error("No se pudo marcar realizado", e);
      setError(mensajeError(e, "No se pudo marcar como realizado."));
    } finally {
      setOcupado(false);
    }
  };

  // Acción confirmada desde una hoja: si falla, muestra el error en la hoja.
  const confirmar = async () => {
    if (ocupado) return;
    setOcupado(true);
    setError(null);
    try {
      if (hoja === "reprogramar") {
        if (!fechaRepro) return;
        await reprogramar({
          token,
          seguimientoId,
          fecha: epochDesdeFechaHora(fechaRepro, horaRepro, negocio.zonaHoraria),
          hora: horaRepro || undefined,
        });
      } else if (hoja === "cancelar") {
        await cancelar({ token, seguimientoId });
      } else if (hoja === "eliminar") {
        await eliminar({ token, seguimientoId });
      }
      setHoja(null);
    } catch (e) {
      console.error("No se pudo completar la acción", e);
      setError(
        mensajeError(
          e,
          hoja === "reprogramar" ? "No se pudo reprogramar." : hoja === "eliminar" ? "No se pudo eliminar." : "No se pudo cancelar.",
        ),
      );
    } finally {
      setOcupado(false);
    }
  };

  const tituloHoja =
    hoja === "reprogramar" ? "Reprogramar recordatorio" : hoja === "eliminar" ? "Eliminar recordatorio" : "Cancelar recordatorio";

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        aria-label="Acciones del recordatorio"
        aria-expanded={menu}
        onClick={() => {
          setError(null);
          setMenu((v) => !v);
        }}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-100 bg-surface active:scale-95"
      >
        <MoreVertical size={17} strokeWidth={2} className="text-body" />
      </button>

      {menu && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setMenu(false)}
          />
          <div className="absolute right-0 top-[42px] z-50 w-52 overflow-hidden rounded-2xl border border-neutral-100 bg-surface py-1.5 shadow-xl">
            <Opcion icon={Check} label="Marcar realizado" disabled={ocupado} onClick={marcar} />
            <Opcion icon={CalendarClock} label="Reprogramar" disabled={ocupado} onClick={() => abrirHoja("reprogramar")} />
            <Opcion icon={XCircle} label="Cancelar" disabled={ocupado} onClick={() => abrirHoja("cancelar")} />
            <div className="my-1 h-px bg-neutral-100" />
            <Opcion icon={Trash2} label="Eliminar" danger disabled={ocupado} onClick={() => abrirHoja("eliminar")} />
            {error && (
              <p className="flex items-start gap-1.5 px-4 pt-1.5 pb-1 text-[12px] font-medium text-danger">
                <AlertCircle size={13} strokeWidth={2} className="mt-0.5 flex-shrink-0" />
                {error}
              </p>
            )}
          </div>
        </>
      )}

      <HojaInferior
        abierta={hoja !== null}
        onCerrar={() => setHoja(null)}
        titulo={<p className="font-serif text-lg font-semibold text-ink">{tituloHoja}</p>}
      >
        <div className="flex flex-col gap-4 pt-1">
          {hoja === "reprogramar" ? (
            <div className="flex gap-3">
              <div className="flex-1">
                <p className="mb-2 text-[13px] font-medium text-ink">Fecha</p>
                <input
                  type="date"
                  value={fechaRepro}
                  onChange={(e) => setFechaRepro(e.target.value)}
                  aria-label="Nueva fecha"
                  className="h-12 w-full rounded-xl border border-border-input bg-surface px-3 text-[14px] text-ink outline-none transition focus:border-gold-500 focus:ring-[3px] focus:ring-gold-500/[0.18]"
                />
              </div>
              <div className="flex-1">
                <p className="mb-2 text-[13px] font-medium text-ink">Hora <span className="font-normal text-muted">(opc.)</span></p>
                <input
                  type="time"
                  value={horaRepro}
                  onChange={(e) => setHoraRepro(e.target.value)}
                  aria-label="Nueva hora"
                  className="h-12 w-full rounded-xl border border-border-input bg-surface px-3 text-[14px] text-ink outline-none transition focus:border-gold-500 focus:ring-[3px] focus:ring-gold-500/[0.18]"
                />
              </div>
            </div>
          ) : (
            <p className="text-[14px] leading-relaxed text-body">
              {hoja === "eliminar"
                ? "Se eliminará permanentemente. Esta acción no se puede deshacer."
                : "El recordatorio pasará a cancelado y desaparecerá de la agenda."}
            </p>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-[#F9ECE7] px-3 py-2.5">
              <AlertCircle size={16} strokeWidth={1.9} className="flex-shrink-0 text-danger" />
              <p className="text-[12.5px] font-medium text-[#8A3F2C]">{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={confirmar}
            disabled={ocupado || (hoja === "reprogramar" && !fechaRepro)}
            className={cn(
              "mt-1 flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-bold transition active:scale-[0.99] disabled:opacity-60",
              hoja === "eliminar" ? "bg-danger text-white" : "bg-gold-500 text-ink shadow-[0_2px_8px_rgba(201,162,94,0.32)]",
            )}
          >
            {ocupado
              ? "Guardando…"
              : hoja === "reprogramar"
                ? "Reprogramar"
                : hoja === "eliminar"
                  ? "Eliminar"
                  : "Cancelar recordatorio"}
          </button>
        </div>
      </HojaInferior>
    </div>
  );
}

function Opcion({
  icon: Icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: typeof Check;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[14px] active:bg-neutral-50 disabled:opacity-60",
        danger ? "text-danger" : "text-ink",
      )}
    >
      <Icon size={16} strokeWidth={1.9} />
      {label}
    </button>
  );
}

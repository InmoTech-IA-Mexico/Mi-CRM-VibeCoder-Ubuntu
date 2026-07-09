"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { MoreVertical, Check, CalendarClock, XCircle, Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useSesion } from "@/components/session/use-sesion";
import { HojaInferior } from "@/components/ui/hoja-inferior";
import { epochDesdeFechaHora } from "@/lib/fechas";
import { cn } from "@/lib/utils";

// Acciones de gestión de un recordatorio (JUA-24): marcar realizado, reprogramar,
// cancelar y eliminar. Solo se renderiza si el usuario puede gestionarlo
// (responsable asignado o admin). El backend valida el permiso igualmente.
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
  const [reproAbierto, setReproAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [fechaRepro, setFechaRepro] = useState(() =>
    new Date(fecha).toLocaleDateString("en-CA", { timeZone: negocio.zonaHoraria }),
  );
  const [horaRepro, setHoraRepro] = useState(hora ?? "");

  if (!puedeGestionar) return null;

  const correr = async (fn: () => Promise<unknown>, fallo: string) => {
    if (ocupado) return;
    setOcupado(true);
    try {
      await fn();
      setMenu(false);
    } catch (e) {
      console.error(fallo, e);
    } finally {
      setOcupado(false);
    }
  };

  const guardarRepro = async () => {
    if (ocupado || !fechaRepro) return;
    setOcupado(true);
    try {
      await reprogramar({
        token,
        seguimientoId,
        fecha: epochDesdeFechaHora(fechaRepro, horaRepro, negocio.zonaHoraria),
        hora: horaRepro || undefined,
      });
      setReproAbierto(false);
      setMenu(false);
    } catch (e) {
      console.error("No se pudo reprogramar", e);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        aria-label="Acciones del recordatorio"
        aria-expanded={menu}
        onClick={() => setMenu((v) => !v)}
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
            <Opcion
              icon={Check}
              label="Marcar realizado"
              disabled={ocupado}
              onClick={() => correr(() => marcarRealizado({ token, seguimientoId }), "No se pudo marcar realizado")}
            />
            <Opcion icon={CalendarClock} label="Reprogramar" disabled={ocupado} onClick={() => setReproAbierto(true)} />
            <Opcion
              icon={XCircle}
              label="Cancelar"
              disabled={ocupado}
              onClick={() => {
                if (window.confirm("¿Cancelar este recordatorio?")) {
                  void correr(() => cancelar({ token, seguimientoId }), "No se pudo cancelar");
                }
              }}
            />
            <div className="my-1 h-px bg-neutral-100" />
            <Opcion
              icon={Trash2}
              label="Eliminar"
              danger
              disabled={ocupado}
              onClick={() => {
                if (window.confirm("¿Eliminar este recordatorio? No se puede deshacer.")) {
                  void correr(() => eliminar({ token, seguimientoId }), "No se pudo eliminar");
                }
              }}
            />
          </div>
        </>
      )}

      <HojaInferior
        abierta={reproAbierto}
        onCerrar={() => setReproAbierto(false)}
        titulo={<p className="font-serif text-lg font-semibold text-ink">Reprogramar recordatorio</p>}
      >
        <div className="flex flex-col gap-4 pt-1">
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
          <button
            type="button"
            onClick={guardarRepro}
            disabled={ocupado || !fechaRepro}
            className={cn(
              "mt-1 flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-bold transition active:scale-[0.99]",
              fechaRepro ? "bg-gold-500 text-ink shadow-[0_2px_8px_rgba(201,162,94,0.32)]" : "cursor-not-allowed bg-neutral-100 text-muted",
            )}
          >
            {ocupado ? "Guardando…" : "Reprogramar"}
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

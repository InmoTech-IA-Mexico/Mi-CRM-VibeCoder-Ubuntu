"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { X, Bell, Calendar, Clock, AlertCircle, Repeat } from "lucide-react";
import { api } from "../../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../../convex/_generated/dataModel";
import { useSesion, useGuardEscritura } from "@/components/session/use-sesion";
import { FRECUENCIAS, LABELS, type Frecuencia, type Prioridad } from "@/lib/enums";
import { epochDesdeFechaHora } from "@/lib/fechas";
import { cn } from "@/lib/utils";

type Detalle = NonNullable<FunctionReturnType<typeof api.clientes.detalle>>;

const PRIORIDADES: { key: Prioridad; punto: string }[] = [
  { key: "alta", punto: "bg-[#B0573F]" },
  { key: "media", punto: "bg-[#C9A25E]" },
  { key: "baja", punto: "bg-[#80847B]" },
];

export function PantallaNuevoRecordatorio({ clienteId }: { clienteId: Id<"clientes"> }) {
  const { token } = useSesion();
  const puedeEditar = useGuardEscritura();
  const cliente = useQuery(api.clientes.detalle, { token, clienteId });

  if (!puedeEditar) return null; // observador: el guard ya redirige a Inicio (JUA-42)
  if (cliente === undefined) {
    return (
      <div className="flex flex-col gap-5 px-4 pt-16">
        <div className="h-28 animate-pulse rounded-[18px] bg-neutral-100" />
        <div className="h-40 animate-pulse rounded-[18px] bg-neutral-100" />
      </div>
    );
  }
  if (cliente === null) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="font-serif text-xl font-semibold text-ink">Cliente no encontrado</p>
        <Link href="/clientes" className="rounded-[22px] border border-border-input bg-surface px-5 py-2.5 text-[14px] font-semibold text-ink shadow-sm">
          Volver a clientes
        </Link>
      </div>
    );
  }

  return <Formulario clienteId={clienteId} cliente={cliente} token={token} />;
}

function Formulario({ clienteId, cliente, token }: { clienteId: Id<"clientes">; cliente: Detalle; token: string }) {
  const router = useRouter();
  const { negocio } = useSesion();
  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [oportunidadId, setOportunidadId] = useState<Id<"oportunidades"> | null>(null);
  const [prioridad, setPrioridad] = useState<Prioridad>("media");
  const [frecuencia, setFrecuencia] = useState<Frecuencia>("una_vez");
  const [fechaFin, setFechaFin] = useState("");
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const crear = useMutation(api.seguimientos.crear);

  const valido = titulo.trim().length > 0 && fecha.length > 0;
  const volver = `/clientes/${clienteId}`;
  const inicial = cliente.nombre.trim().charAt(0).toUpperCase() || "?";

  const guardar = async () => {
    if (guardando) return;
    if (!valido) return setIntentado(true);
    setGuardando(true);
    setError(null);
    try {
      const recurrente = frecuencia !== "una_vez";
      // Fecha de fin inclusiva: fin del día seleccionado (para no excluir la
      // última ocurrencia del propio día "Termina el").
      const finDeDia = fechaFin ? epochDesdeFechaHora(fechaFin, "", negocio.zonaHoraria) + 24 * 60 * 60 * 1000 - 1 : undefined;
      await crear({
        token,
        clienteId,
        titulo,
        fecha: epochDesdeFechaHora(fecha, hora, negocio.zonaHoraria),
        hora: hora || undefined,
        descripcion: descripcion.trim() || undefined,
        oportunidadId: oportunidadId ?? undefined,
        prioridad,
        frecuencia,
        fechaFin: recurrente ? finDeDia : undefined,
        // Día-del-mes local (del calendario del negocio), no derivado del epoch.
        diaRecurrencia: frecuencia === "mensual" ? Number(fecha.split("-")[2]) : undefined,
      });
      router.replace(volver);
    } catch (e) {
      console.error("No se pudo crear el recordatorio", e);
      setError("No se pudo crear el recordatorio. Inténtalo de nuevo.");
      setGuardando(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="relative flex h-14 items-center justify-center px-3.5">
        <button
          type="button"
          aria-label="Cancelar"
          onClick={() => router.push(volver)}
          className="absolute left-3.5 flex h-11 w-11 items-center justify-center rounded-xl border border-border-input bg-surface shadow-sm active:scale-95"
        >
          <X size={20} strokeWidth={2} className="text-ink" />
        </button>
        <h1 className="font-serif text-xl font-semibold text-ink">Nuevo recordatorio</h1>
        <button
          type="button"
          onClick={guardar}
          disabled={!valido || guardando}
          aria-busy={guardando}
          className={cn(
            "absolute right-3.5 rounded-full px-4 py-2 text-[14px] font-semibold transition",
            valido
              ? "bg-gold-500 text-ink shadow-[0_2px_6px_rgba(201,162,94,0.32)] active:scale-95"
              : "cursor-not-allowed bg-neutral-100 text-muted",
          )}
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </header>

      <div className="flex flex-col gap-4 px-4 pt-2 pb-10">
        {/* Cliente */}
        <div className="flex items-center gap-2 self-start rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2">
          <span className="text-[12.5px] text-body">Cliente:</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-tint text-[11px] font-semibold text-gold-700">{inicial}</span>
          <span className="text-[13.5px] font-semibold text-ink">{cliente.nombre}</span>
        </div>

        {/* Título */}
        <div className="rounded-[18px] border border-neutral-100 bg-surface p-4 shadow-sm">
          <p className="mb-2 text-[13px] font-medium text-ink">Título <span className="text-danger">*</span></p>
          <div
            className={cn(
              "flex h-12 items-center gap-2.5 rounded-xl border px-3 transition",
              intentado && titulo.trim().length === 0
                ? "border-danger ring-[3px] ring-danger/15"
                : "border-border-input focus-within:border-gold-500 focus-within:ring-[3px] focus-within:ring-gold-500/[0.18]",
            )}
          >
            <Bell size={18} strokeWidth={1.6} className="text-neutral-400" />
            <input
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Llamar para cerrar propuesta"
              aria-label="Título del recordatorio"
              className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
            />
          </div>
        </div>

        {/* Cuándo: fecha + hora */}
        <div className="rounded-[18px] border border-neutral-100 bg-surface p-4 shadow-sm">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gold-text">Cuándo</p>
          <div className="flex gap-3">
            <div className="flex-1">
              <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-ink">
                <Calendar size={14} strokeWidth={1.7} className="text-neutral-400" /> Fecha <span className="text-danger">*</span>
              </p>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                aria-label="Fecha programada"
                className={cn(
                  "h-12 w-full rounded-xl border bg-surface px-3 text-[14px] text-ink outline-none transition",
                  intentado && !fecha
                    ? "border-danger ring-[3px] ring-danger/15"
                    : "border-border-input focus:border-gold-500 focus:ring-[3px] focus:ring-gold-500/[0.18]",
                )}
              />
            </div>
            <div className="flex-1">
              <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-ink">
                <Clock size={14} strokeWidth={1.7} className="text-neutral-400" /> Hora <span className="font-normal text-muted">(opc.)</span>
              </p>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                aria-label="Hora programada"
                className="h-12 w-full rounded-xl border border-border-input bg-surface px-3 text-[14px] tabular-nums text-ink outline-none transition focus:border-gold-500 focus:ring-[3px] focus:ring-gold-500/[0.18]"
              />
            </div>
          </div>
        </div>

        {/* Frecuencia (JUA-115) */}
        <div className="rounded-[18px] border border-neutral-100 bg-surface p-4 shadow-sm">
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-ink">
            <Repeat size={14} strokeWidth={1.7} className="text-neutral-400" /> Frecuencia
          </p>
          <div className="flex gap-2">
            {FRECUENCIAS.map((f) => {
              const activo = frecuencia === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrecuencia(f)}
                  className={cn(
                    "flex-1 rounded-xl border py-2.5 text-[13.5px] font-medium transition active:scale-[0.98]",
                    activo ? "border-gold-500 bg-gold-tint text-gold-700" : "border-border-input bg-surface text-body",
                  )}
                >
                  {LABELS.frecuencia[f]}
                </button>
              );
            })}
          </div>
          {frecuencia !== "una_vez" && (
            <div className="mt-3">
              <p className="mb-2 text-[13px] font-medium text-ink">
                Termina el <span className="font-normal text-muted">(opcional)</span>
              </p>
              <input
                type="date"
                value={fechaFin}
                min={fecha || undefined}
                onChange={(e) => setFechaFin(e.target.value)}
                aria-label="Fecha de fin de la recurrencia"
                className="h-12 w-full rounded-xl border border-border-input bg-surface px-3 text-[14px] text-ink outline-none transition focus:border-gold-500 focus:ring-[3px] focus:ring-gold-500/[0.18]"
              />
              <p className="mt-1.5 text-[11.5px] leading-snug text-muted">
                Se repetirá {frecuencia === "semanal" ? "cada semana" : "cada mes"} desde la fecha programada
                {fechaFin ? "" : "; sin fecha de fin, hasta que lo canceles"}.
              </p>
            </div>
          )}
        </div>

        {/* Prioridad */}
        <div className="rounded-[18px] border border-neutral-100 bg-surface p-4 shadow-sm">
          <p className="mb-2 text-[13px] font-medium text-ink">Prioridad</p>
          <div className="flex gap-2 rounded-2xl border border-[#E0D9C9] bg-[#F0ECE2] p-1.5">
            {PRIORIDADES.map(({ key, punto }) => {
              const activo = prioridad === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPrioridad(key)}
                  className={cn(
                    "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] text-[14px] transition",
                    activo ? "border border-gold-500 bg-surface font-semibold text-ink shadow-sm" : "font-medium text-body",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", punto)} />
                  {LABELS.prioridad[key]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Oportunidad relacionada (opcional) */}
        {cliente.oportunidades.length > 0 && (
          <section>
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gold-text">
              Oportunidad relacionada <span className="font-normal normal-case text-muted">(opcional)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {cliente.oportunidades.map((o) => {
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
          </section>
        )}

        {/* Descripción */}
        <section>
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gold-text">
            Descripción <span className="font-normal normal-case text-muted">(opcional)</span>
          </p>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="¿Qué hay que hacer?"
            aria-label="Descripción"
            rows={3}
            className="w-full resize-none rounded-xl border border-border-input bg-surface p-3.5 text-[14.5px] leading-relaxed text-ink outline-none transition placeholder:text-muted focus:border-gold-500 focus:ring-[3px] focus:ring-gold-500/[0.18]"
          />
        </section>

        <p className="px-1 text-[12px] leading-snug text-muted">
          Aparecerá en tu pantalla de Inicio el día programado. En el MVP no hay notificaciones push.
        </p>

        {error && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-danger/30 bg-[#F9ECE7] p-3.5">
            <AlertCircle size={18} strokeWidth={1.9} className="flex-shrink-0 text-danger" />
            <p className="text-[13px] font-medium text-[#8A3F2C]">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

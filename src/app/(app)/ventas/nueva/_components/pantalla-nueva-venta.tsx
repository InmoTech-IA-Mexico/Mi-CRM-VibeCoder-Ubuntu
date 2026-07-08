"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import {
  X, Search, Info, AlertCircle, Check, ChevronRight,
  MessageCircle, Mail, Globe, Phone, Users, Radio,
} from "lucide-react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { useSesion } from "@/components/session/use-sesion";
import { epochDesdeFechaHora } from "@/lib/fechas";
import { CANALES, LABELS, type Canal } from "@/lib/enums";
import { cn } from "@/lib/utils";

// Alta de venta desde el módulo Ventas (JUA-111): selector de cliente con
// buscador + canal propio de la venta. Mismo comportamiento que el registro
// desde la ficha (JUA-110): se añade al historial y el estado no cambia.
const ETAPAS_CERRADAS = ["ganada", "perdida", "cancelada"];

const ICONO_CANAL: Record<Canal, typeof MessageCircle> = {
  whatsapp: MessageCircle,
  email: Mail,
  web: Globe,
  telefono: Phone,
  referido: Users,
  redes: Radio,
};

export function PantallaNuevaVenta() {
  const router = useRouter();
  const { token, negocio, usuario } = useSesion();

  const [clienteId, setClienteId] = useState<Id<"clientes"> | null>(null);
  const [pickerAbierto, setPickerAbierto] = useState(false);
  const [oportunidadId, setOportunidadId] = useState<Id<"oportunidades"> | null>(null);
  const [importe, setImporte] = useState("");
  const [fecha, setFecha] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: negocio.zonaHoraria }),
  );
  const [canalSel, setCanalSel] = useState<Canal | null>(null);
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const crear = useMutation(api.ventas.crear);

  const clientes = useQuery(api.clientes.listar, { token }) ?? [];
  const clienteSel = clientes.find((c) => c._id === clienteId) ?? null;
  // Oportunidades abiertas del cliente elegido (para vincular la venta).
  const detalle = useQuery(api.clientes.detalle, clienteId ? { token, clienteId } : "skip");
  const oportunidades = (detalle?.oportunidades ?? []).filter(
    (o) => !ETAPAS_CERRADAS.includes(o.etapa),
  );

  const importeNum = Number(importe.replace(/[^\d.]/g, ""));
  const clienteOk = clienteId != null;
  const importeOk = importe.trim().length > 0 && importeNum > 0;
  const valido = clienteOk && importeOk && fecha.length > 0;

  const elegirCliente = (id: Id<"clientes">) => {
    setClienteId(id);
    setOportunidadId(null); // las oportunidades dependen del cliente
    setPickerAbierto(false);
  };

  const guardar = async () => {
    if (guardando) return;
    if (!valido) {
      setIntentado(true);
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await crear({
        token,
        clienteId: clienteId!,
        oportunidadId: oportunidadId ?? undefined,
        importe: importeNum,
        fecha: epochDesdeFechaHora(fecha, "", negocio.zonaHoraria),
        canal: canalSel ?? undefined,
      });
      router.push("/ventas");
    } catch (e) {
      console.error("No se pudo registrar la venta", e);
      setError("No se pudo registrar la venta. Inténtalo de nuevo.");
      setGuardando(false);
    }
  };

  const mostrarErrorCliente = intentado && !clienteOk;
  const mostrarErrorImporte = intentado && !importeOk;

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <header className="relative flex h-14 items-center justify-center px-3.5">
        <button
          type="button"
          aria-label="Cerrar"
          onClick={() => router.push("/ventas")}
          className="absolute left-3.5 flex h-11 w-11 items-center justify-center rounded-xl border border-border-input bg-surface shadow-sm active:scale-95"
        >
          <X size={20} strokeWidth={2} className="text-ink" />
        </button>
        <h1 className="font-serif text-xl font-semibold text-ink">Registrar venta</h1>
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

      <div className="flex flex-col gap-5 px-4 pt-2 pb-10">
        {/* Cliente (obligatorio, selector con buscador) */}
        <section>
          <p className="mb-2 text-[13px] font-medium text-ink">
            Cliente <span className="text-danger">*</span>
          </p>
          <button
            type="button"
            onClick={() => setPickerAbierto(true)}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border bg-surface p-3.5 text-left shadow-sm transition active:scale-[0.99]",
              mostrarErrorCliente ? "border-danger ring-[3px] ring-danger/15" : "border-neutral-100",
            )}
          >
            {clienteSel ? (
              <>
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D2B074] to-[#B68E45]">
                  <span className="font-serif text-base font-semibold text-white">
                    {clienteSel.nombre.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink">{clienteSel.nombre}</p>
                  {clienteSel.empresa && (
                    <p className="truncate text-[12.5px] text-muted">{clienteSel.empresa}</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-neutral-50">
                  <Search size={18} strokeWidth={1.8} className="text-neutral-400" />
                </div>
                <span className="flex-1 text-[15px] text-muted">Seleccionar cliente</span>
              </>
            )}
            <ChevronRight size={18} strokeWidth={1.8} className="flex-shrink-0 text-muted" />
          </button>
          {mostrarErrorCliente && (
            <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-danger">
              <AlertCircle size={14} strokeWidth={1.9} />
              Elige el cliente de la venta
            </p>
          )}
        </section>

        {/* Venta: importe + fecha */}
        <section>
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gold-text">Venta</p>
          <div className="flex gap-3">
            <div className="flex-1">
              <p className="mb-2 text-[13px] font-medium text-ink">
                Importe <span className="text-danger">*</span>
              </p>
              <div
                className={cn(
                  "flex h-12 items-center gap-1.5 rounded-xl border px-3 transition",
                  mostrarErrorImporte
                    ? "border-danger ring-[3px] ring-danger/15"
                    : "border-border-input focus-within:border-gold-500 focus-within:ring-[3px] focus-within:ring-gold-500/[0.18]",
                )}
              >
                <span className="text-[15px] font-semibold text-muted">$</span>
                <input
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
          {mostrarErrorImporte && (
            <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-danger">
              <AlertCircle size={14} strokeWidth={1.9} />
              Indica un importe mayor que cero
            </p>
          )}
        </section>

        {/* Oportunidad (opcional) — solo si el cliente tiene abiertas */}
        {clienteId && oportunidades.length > 0 && (
          <section>
            <p className="mb-2 text-[13px] font-medium text-ink">
              Oportunidad <span className="font-normal text-muted">(opcional)</span>
            </p>
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
                      activo
                        ? "border-gold-500 bg-gold-tint text-gold-700"
                        : "border-border-input bg-surface text-body",
                    )}
                  >
                    {o.nombre}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ¿Cómo nos contactó? (opcional, canal propio de la venta) */}
        <section>
          <p className="mb-2 text-[13px] font-medium text-ink">
            ¿Cómo nos contactó? <span className="font-normal text-muted">(opcional)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {CANALES.map((c) => {
              const Icon = ICONO_CANAL[c];
              const activo = canalSel === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCanalSel(activo ? null : c)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[13px] font-medium transition active:scale-95",
                    activo
                      ? "border-gold-500 bg-gold-tint text-gold-700"
                      : "border-border-input bg-surface text-body",
                  )}
                >
                  <Icon size={14} strokeWidth={1.9} />
                  {LABELS.canal[c]}
                </button>
              );
            })}
          </div>
        </section>

        {/* Registrado por (usuario de sesión, informativo) */}
        <section>
          <p className="mb-2 text-[13px] font-medium text-ink">Registrado por</p>
          <div className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-neutral-50 p-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D2B074] to-[#B68E45]">
              <span className="font-serif text-[14px] font-semibold text-white">
                {usuario.nombre.charAt(0).toUpperCase()}
              </span>
            </div>
            <p className="text-[14px] font-medium text-ink">{usuario.nombre}</p>
          </div>
        </section>

        {/* Nota + error */}
        <div className="flex items-start gap-2 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5">
          <Info size={16} strokeWidth={1.8} className="mt-0.5 flex-shrink-0 text-neutral-400" />
          <p className="text-[12.5px] leading-snug text-body">
            Se añadirá al historial del cliente. El estado se mantiene.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-danger/30 bg-[#F9ECE7] p-3.5">
            <AlertCircle size={18} strokeWidth={1.9} className="flex-shrink-0 text-danger" />
            <p className="text-[13px] font-medium text-[#8A3F2C]">{error}</p>
          </div>
        )}
      </div>

      {pickerAbierto && (
        <SelectorCliente
          clientes={clientes}
          seleccionadoId={clienteId}
          onElegir={elegirCliente}
          onCerrar={() => setPickerAbierto(false)}
        />
      )}
    </div>
  );
}

type ClienteRow = { _id: Id<"clientes">; nombre: string; empresa: string | null; telefono: string | null; email: string | null };

/** Bottom sheet para elegir cliente con buscador (nombre/empresa/teléfono/email). */
function SelectorCliente({
  clientes,
  seleccionadoId,
  onElegir,
  onCerrar,
}: {
  clientes: ClienteRow[];
  seleccionadoId: Id<"clientes"> | null;
  onElegir: (id: Id<"clientes">) => void;
  onCerrar: () => void;
}) {
  const [q, setQ] = useState("");
  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return clientes;
    return clientes.filter((c) =>
      [c.nombre, c.empresa, c.telefono, c.email]
        .filter(Boolean)
        .some((campo) => campo!.toLowerCase().includes(t)),
    );
  }, [q, clientes]);

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end">
      <button type="button" aria-label="Cerrar" onClick={onCerrar} className="absolute inset-0 cursor-default bg-[rgba(11,37,42,0.45)]" />
      <div className="relative flex max-h-[80vh] w-full flex-col rounded-t-[24px] border-t border-neutral-100 bg-surface p-5 pb-8 shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-neutral-200" />
        <div className="mb-3 flex items-center justify-between">
          <p className="font-serif text-[18px] font-semibold text-ink">Elegir cliente</p>
          <button type="button" aria-label="Cerrar" onClick={onCerrar} className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-50 text-body">
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <div className="mb-3 flex h-11 items-center gap-2 rounded-xl border border-border-input px-3 transition focus-within:border-gold-500 focus-within:ring-[3px] focus-within:ring-gold-500/[0.18]">
          <Search size={17} strokeWidth={1.8} className="text-neutral-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, empresa o teléfono"
            aria-label="Buscar cliente"
            className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
          />
        </div>
        <div className="-mx-1 flex-1 overflow-y-auto">
          {filtrados.length === 0 ? (
            <p className="px-1 py-6 text-center text-[13.5px] text-muted">Sin resultados</p>
          ) : (
            filtrados.map((c) => {
              const sel = seleccionadoId === c._id;
              return (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => onElegir(c._id)}
                  className="flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left active:bg-row-hover"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D2B074] to-[#B68E45]">
                    <span className="font-serif text-[15px] font-semibold text-white">
                      {c.nombre.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-medium text-ink">{c.nombre}</p>
                    {(c.empresa || c.telefono) && (
                      <p className="truncate text-[12.5px] text-muted">{c.empresa ?? c.telefono}</p>
                    )}
                  </div>
                  {sel && <Check size={18} strokeWidth={2.2} className="flex-shrink-0 text-gold-700" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

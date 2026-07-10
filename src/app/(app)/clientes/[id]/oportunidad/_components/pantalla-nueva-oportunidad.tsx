"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { X, AlertCircle } from "lucide-react";
import { api } from "../../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../../convex/_generated/dataModel";
import { useSesion } from "@/components/session/use-sesion";
import { LABELS } from "@/lib/enums";
import { epochDesdeFechaHora } from "@/lib/fechas";
import { cn } from "@/lib/utils";

// Etapas abiertas para el alta (las cerradas —ganada/perdida/cancelada— se
// alcanzan luego desde la ficha, y perdida/cancelada exigen motivo).
type EtapaInicial = "nueva" | "en_contacto" | "propuesta" | "negociacion";
const ETAPAS_ALTA: { key: EtapaInicial; punto: string }[] = [
  { key: "nueva", punto: "bg-[#80847B]" },
  { key: "en_contacto", punto: "bg-[#2E6E78]" },
  { key: "propuesta", punto: "bg-[#0E2E34]" },
  { key: "negociacion", punto: "bg-[#C9A25E]" },
];
const PRODUCTOS = ["Formación", "Consultoría", "Plantilla", "Otro"];
const MODELOS: { key: "unico" | "recurrente"; label: string }[] = [
  { key: "unico", label: "Pago único" },
  { key: "recurrente", label: "Recurrente" },
];

export function PantallaNuevaOportunidad({ clienteId }: { clienteId: Id<"clientes"> }) {
  const { token } = useSesion();
  const cliente = useQuery(api.clientes.detalle, { token, clienteId });

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

  return <Formulario clienteId={clienteId} nombre={cliente.nombre} token={token} />;
}

function Formulario({ clienteId, nombre, token }: { clienteId: Id<"clientes">; nombre: string; token: string }) {
  const router = useRouter();
  const { negocio } = useSesion();
  const [nombreOpo, setNombreOpo] = useState("");
  const [etapa, setEtapa] = useState<EtapaInicial>("nueva");
  const [producto, setProducto] = useState<string | null>(null);
  const [modelo, setModelo] = useState<"unico" | "recurrente" | null>(null);
  const [monto, setMonto] = useState("");
  const [fechaCierre, setFechaCierre] = useState("");
  const [comentarios, setComentarios] = useState("");
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const crear = useMutation(api.oportunidades.crear);

  const valido = nombreOpo.trim().length > 0;
  const volver = `/clientes/${clienteId}`;
  const inicial = nombre.trim().charAt(0).toUpperCase() || "?";

  const guardar = async () => {
    if (guardando) return;
    if (!valido) return setIntentado(true);
    setGuardando(true);
    setError(null);
    const montoNum = monto.trim() ? Number(monto.replace(/[^\d.]/g, "")) : undefined;
    // La fecha de cierre es una fecha-only; se ancla a la zona del negocio (JUA-28),
    // no a UTC/servidor, para que al mostrarse no se desfase un día.
    const fecha = fechaCierre ? epochDesdeFechaHora(fechaCierre, "", negocio.zonaHoraria) : undefined;
    try {
      await crear({
        token,
        clienteId,
        nombre: nombreOpo,
        etapa,
        productoServicio: producto ?? undefined,
        modeloVenta: modelo ?? undefined,
        monto: montoNum != null && !Number.isNaN(montoNum) ? montoNum : undefined,
        fechaCierre: fecha,
        comentarios: comentarios.trim() || undefined,
      });
      router.replace(volver);
    } catch (e) {
      console.error("No se pudo crear la oportunidad", e);
      setError("No se pudo crear la oportunidad. Inténtalo de nuevo.");
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
        <h1 className="font-serif text-xl font-semibold text-ink">Nueva oportunidad</h1>
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
          <span className="text-[12.5px] text-body">Para:</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-tint text-[11px] font-semibold text-gold-700">{inicial}</span>
          <span className="text-[13.5px] font-semibold text-ink">{nombre}</span>
        </div>

        {/* Nombre + etapa */}
        <div className="overflow-hidden rounded-[18px] border border-neutral-100 bg-surface shadow-sm">
          <div className="p-4">
            <p className="mb-2 text-[13px] font-medium text-ink">
              Nombre <span className="text-danger">*</span>
            </p>
            <input
              autoFocus
              value={nombreOpo}
              onChange={(e) => setNombreOpo(e.target.value)}
              placeholder="Ej: Consultoría 3 meses"
              aria-label="Nombre de la oportunidad"
              className={cn(
                "h-12 w-full rounded-xl border bg-transparent px-3 text-[15px] text-ink outline-none transition placeholder:text-muted",
                intentado && !valido
                  ? "border-danger ring-[3px] ring-danger/15"
                  : "border-border-input focus:border-gold-500 focus:ring-[3px] focus:ring-gold-500/[0.18]",
              )}
            />
            {intentado && !valido && (
              <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-danger">
                <AlertCircle size={14} strokeWidth={1.9} /> El nombre es obligatorio
              </p>
            )}
          </div>
          <div className="mx-4 h-px bg-neutral-100" />
          <div className="p-4">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gold-text">Etapa</p>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {ETAPAS_ALTA.map(({ key, punto }) => {
                const activo = etapa === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEtapa(key)}
                    className={cn(
                      "flex flex-none items-center gap-1.5 rounded-pill border px-3.5 py-2 text-[12.5px] font-medium transition",
                      activo ? "border-gold-500 bg-gold-tint text-gold-700" : "border-border-input bg-surface text-body",
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", punto)} />
                    {LABELS.etapa[key]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Producto/servicio */}
        <section>
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gold-text">
            Producto o servicio <span className="font-normal normal-case text-muted">(opcional)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {PRODUCTOS.map((p) => {
              const activo = producto === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProducto(activo ? null : p)}
                  className={cn(
                    "rounded-pill border px-3.5 py-1.5 text-[13px] font-medium transition active:scale-95",
                    activo ? "border-gold-500 bg-gold-tint text-gold-700" : "border-border-input bg-surface text-body",
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </section>

        {/* Modelo de venta + monto + fecha */}
        <div className="flex flex-col gap-4 rounded-[18px] border border-neutral-100 bg-surface p-4 shadow-sm">
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink">Modelo de venta <span className="font-normal text-muted">(opcional)</span></p>
            <div className="flex gap-2 rounded-2xl border border-[#E0D9C9] bg-[#F0ECE2] p-1.5">
              {MODELOS.map(({ key, label }) => {
                const activo = modelo === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setModelo(activo ? null : key)}
                    className={cn(
                      "h-10 flex-1 rounded-[10px] text-[14px] transition",
                      activo ? "border border-gold-500 bg-surface font-semibold text-ink shadow-sm" : "font-medium text-body",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <p className="mb-2 text-[13px] font-medium text-ink">Monto</p>
              <div className="flex h-12 items-center gap-1.5 rounded-xl border border-border-input px-3 transition focus-within:border-gold-500 focus-within:ring-[3px] focus-within:ring-gold-500/[0.18]">
                <span className="text-[15px] font-semibold text-muted">$</span>
                <input
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                  aria-label="Monto estimado"
                  className="w-full bg-transparent text-[15px] tabular-nums text-ink outline-none placeholder:text-muted"
                />
              </div>
            </div>
            <div className="flex-1">
              <p className="mb-2 text-[13px] font-medium text-ink">Fecha de cierre</p>
              <input
                type="date"
                value={fechaCierre}
                onChange={(e) => setFechaCierre(e.target.value)}
                aria-label="Fecha de cierre"
                className="h-12 w-full rounded-xl border border-border-input bg-surface px-3 text-[14px] text-ink outline-none transition focus:border-gold-500 focus:ring-[3px] focus:ring-gold-500/[0.18]"
              />
            </div>
          </div>
        </div>

        {/* Descripción */}
        <section>
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gold-text">
            Descripción o notas <span className="font-normal normal-case text-muted">(opcional)</span>
          </p>
          <textarea
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            placeholder="Información adicional…"
            aria-label="Descripción o notas"
            rows={4}
            className="w-full resize-none rounded-xl border border-border-input bg-surface p-3.5 text-[14.5px] leading-relaxed text-ink outline-none transition placeholder:text-muted focus:border-gold-500 focus:ring-[3px] focus:ring-gold-500/[0.18]"
          />
        </section>

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

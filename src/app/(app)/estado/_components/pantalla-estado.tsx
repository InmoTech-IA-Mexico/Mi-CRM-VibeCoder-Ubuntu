"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { ChevronLeft, ChevronRight, Users, TrendingUp, Bell, AlertTriangle } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { useSesion } from "@/components/session/use-sesion";
import { LABELS, type EstadoCliente, type EtapaPipeline } from "@/lib/enums";
import { cn } from "@/lib/utils";

// Estado global de clientes (JUA-35). Dashboard agregado del negocio, ambos
// roles. Totales por estado (clicables → lista filtrada), oportunidades abiertas
// por etapa, seguimientos pendientes/vencidos y clientes sin atender.
const PUNTO_ESTADO: Record<EstadoCliente, string> = {
  nuevo: "bg-[#80847B]",
  prospecto: "bg-[#2E6E78]",
  activo: "bg-teal-800",
  inactivo: "bg-gold-500",
  descartado: "bg-neutral-300",
};

export function PantallaEstado() {
  const router = useRouter();
  const { token } = useSesion();
  const data = useQuery(api.inicio.estadoGlobal, { token });

  return (
    <div className="flex min-h-full flex-col">
      <header className="relative flex h-14 items-center justify-between px-4">
        <button
          type="button"
          aria-label="Volver"
          onClick={() => router.back()}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-input bg-surface shadow-sm active:scale-95"
        >
          <ChevronLeft size={20} strokeWidth={2} className="text-ink" />
        </button>
        <h1 className="font-serif text-xl font-semibold text-ink">Estado del negocio</h1>
        <div className="w-11" />
      </header>

      {data === undefined ? (
        <p className="px-4 py-10 text-center text-[14px] text-muted">Cargando…</p>
      ) : data ? (
        <div className="flex flex-col gap-5 px-4 pb-10">
          {/* Clientes por estado */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-gold-text">Clientes por estado</p>
              <span className="flex items-center gap-1 text-[12.5px] font-medium text-body">
                <Users size={13} strokeWidth={1.9} />
                {data.total} en total
              </span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-surface shadow-sm">
              {data.porEstado.map((e, i) => (
                <Link
                  key={e.estado}
                  href={`/clientes?estado=${e.estado}`}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 active:bg-row-hover",
                    i > 0 && "border-t border-neutral-100",
                  )}
                >
                  <span className={cn("h-2.5 w-2.5 flex-shrink-0 rounded-full", PUNTO_ESTADO[e.estado as EstadoCliente])} />
                  <span className="flex-1 text-[14.5px] text-ink">{LABELS.estadoCliente[e.estado as EstadoCliente]}</span>
                  <span className="text-[12.5px] tabular-nums text-muted">{e.pct}%</span>
                  <span className="w-7 text-right font-serif text-[16px] font-semibold tabular-nums text-ink">{e.count}</span>
                  <ChevronRight size={16} strokeWidth={1.8} className="flex-shrink-0 text-muted" />
                </Link>
              ))}
            </div>
          </section>

          {/* Clientes sin atender */}
          <Link
            href="/inicio"
            className={cn(
              "flex items-center gap-3 rounded-2xl border p-4 shadow-sm active:scale-[0.99]",
              data.sinAtender > 0 ? "border-[#E0C795] bg-[#F9F1DF]" : "border-neutral-100 bg-surface",
            )}
          >
            <div
              className={cn(
                "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full",
                data.sinAtender > 0 ? "bg-[#F4E4C1] text-[#9A7327]" : "bg-neutral-100 text-neutral-400",
              )}
            >
              <AlertTriangle size={20} strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn("text-[15px] font-semibold", data.sinAtender > 0 ? "text-[#8A6420]" : "text-ink")}>
                {data.sinAtender} sin atender
              </p>
              <p className={cn("text-[12.5px]", data.sinAtender > 0 ? "text-[#9A7327]" : "text-muted")}>
                Más de 15 días sin contacto
              </p>
            </div>
            <ChevronRight size={18} strokeWidth={1.8} className={cn("flex-shrink-0", data.sinAtender > 0 ? "text-[#B99A5A]" : "text-muted")} />
          </Link>

          {/* Oportunidades abiertas */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-gold-text">Oportunidades abiertas</p>
              <span className="flex items-center gap-1 text-[12.5px] font-medium text-body">
                <TrendingUp size={13} strokeWidth={1.9} />
                {data.oportunidades.total} en curso
              </span>
            </div>
            {data.oportunidades.total === 0 ? (
              <p className="rounded-2xl border border-neutral-100 bg-surface px-4 py-4 text-center text-[13.5px] text-muted">
                No hay oportunidades abiertas.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {data.oportunidades.porEtapa.map((e) => (
                  <div key={e.etapa} className="flex items-center justify-between rounded-2xl border border-neutral-100 bg-surface px-3.5 py-3 shadow-sm">
                    <span className="text-[13px] text-body">{LABELS.etapa[e.etapa as EtapaPipeline]}</span>
                    <span className="font-serif text-[17px] font-semibold tabular-nums text-ink">{e.count}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Seguimientos pendientes */}
          <section>
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gold-text">Seguimientos pendientes</p>
            <div className="flex gap-2.5">
              <div className="flex flex-1 items-center gap-3 rounded-2xl border border-neutral-100 bg-surface p-3.5 shadow-sm">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gold-tint">
                  <Bell size={18} strokeWidth={1.8} className="text-gold-700" />
                </div>
                <div>
                  <p className="font-serif text-[20px] font-semibold tabular-nums text-ink">{data.seguimientos.pendientes}</p>
                  <p className="text-[12px] text-muted">Pendientes</p>
                </div>
              </div>
              <div className="flex flex-1 items-center gap-3 rounded-2xl border border-neutral-100 bg-surface p-3.5 shadow-sm">
                <div
                  className={cn(
                    "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full",
                    data.seguimientos.vencidos > 0 ? "bg-[#F9ECE7] text-danger" : "bg-neutral-100 text-neutral-400",
                  )}
                >
                  <AlertTriangle size={18} strokeWidth={1.8} />
                </div>
                <div>
                  <p className={cn("font-serif text-[20px] font-semibold tabular-nums", data.seguimientos.vencidos > 0 ? "text-danger" : "text-ink")}>
                    {data.seguimientos.vencidos}
                  </p>
                  <p className="text-[12px] text-muted">Vencidos</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { TrendingUp, TrendingDown, MessageCircle, Mail, Globe, Phone, Users, Radio, HelpCircle, Trophy } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { useSesion } from "@/components/session/use-sesion";
import { MenuPerfil } from "@/components/layout/menu-perfil";
import { LABELS, type Canal } from "@/lib/enums";
import { rangoPeriodoEnZona, fechaCortaES, diasDesde, type PeriodoVentas } from "@/lib/fechas";
import { cn } from "@/lib/utils";

const PERIODOS: { key: PeriodoVentas; label: string; hero: string; vs: string }[] = [
  { key: "mes", label: "Este mes", hero: "Este mes", vs: "mes anterior" },
  { key: "trimestre", label: "Trimestre", hero: "Este trimestre", vs: "trimestre anterior" },
  { key: "año", label: "Año", hero: "Este año", vs: "año anterior" },
];

const ICONO_CANAL: Record<Canal, typeof MessageCircle> = {
  whatsapp: MessageCircle,
  email: Mail,
  web: Globe,
  telefono: Phone,
  referido: Users,
  redes: Radio,
};

const BARRA_CANAL = ["bg-[#16454C]", "bg-[#2E6E78]", "bg-[#5E8A90]", "bg-[#8FB0B4]", "bg-[#A7A395]", "bg-[#C9A25E]"];

const money = (n: number) => "$" + new Intl.NumberFormat("es-MX").format(n);

function labelCanal(canal: string): string {
  return canal === "sin_canal" ? "Sin canal" : LABELS.canal[canal as Canal];
}

export function PantallaVentas() {
  const { token, negocio } = useSesion();
  const [periodo, setPeriodo] = useState<PeriodoVentas>("mes");
  const [ahora] = useState(() => Date.now());
  const rango = useMemo(
    () => rangoPeriodoEnZona(periodo, negocio.zonaHoraria, ahora),
    [periodo, negocio.zonaHoraria, ahora],
  );
  const cfg = PERIODOS.find((p) => p.key === periodo)!;
  const data = useQuery(api.ventas.resumen, { token, ...rango });

  return (
    <div className="px-4 pt-2">
      <header className="flex items-center justify-between py-2">
        <h1 className="font-serif text-2xl font-semibold text-ink">Ventas</h1>
        <MenuPerfil />
      </header>

      {/* Chips de periodo */}
      <div className="mt-1.5 flex gap-2">
        {PERIODOS.map((p) => {
          const activo = periodo === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriodo(p.key)}
              className={cn(
                "rounded-pill border px-3.5 py-1.5 text-[13px] font-medium transition",
                activo ? "border-gold-500 bg-gold-tint text-gold-700" : "border-border-input bg-surface text-body",
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {data === undefined ? (
        <div className="mt-4 flex flex-col gap-3">
          <div className="h-32 animate-pulse rounded-[20px] bg-neutral-100" />
          <div className="h-20 animate-pulse rounded-2xl bg-neutral-100" />
        </div>
      ) : data === null || data.count === 0 ? (
        <Vacio />
      ) : (
        <div className="mt-4 flex flex-col pb-8">
          {/* Hero total */}
          <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#16454C] to-[#0E2E34] p-5 shadow-[0_10px_26px_rgba(14,46,52,0.22)]">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-gold-500">
              Total vendido · {cfg.hero}
            </p>
            <p className="mt-2 font-serif text-[38px] font-semibold tabular-nums tracking-tight text-[#F1EAD8]">
              {money(data.total)}
            </p>
            {data.variacion != null && (
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-2 py-0.5",
                    data.variacion >= 0 ? "bg-[rgba(46,125,107,0.30)]" : "bg-[rgba(176,87,63,0.30)]",
                  )}
                >
                  {data.variacion >= 0 ? (
                    <TrendingUp size={13} strokeWidth={2.4} className="text-[#9FE0CC]" />
                  ) : (
                    <TrendingDown size={13} strokeWidth={2.4} className="text-[#F0B8A8]" />
                  )}
                  <span className={cn("text-[12px] font-semibold", data.variacion >= 0 ? "text-[#9FE0CC]" : "text-[#F0B8A8]")}>
                    {data.variacion >= 0 ? "+" : ""}{data.variacion}%
                  </span>
                </span>
                <span className="text-[12.5px] text-[#B8C2BF]">vs. {cfg.vs}</span>
              </div>
            )}
          </div>

          {/* KPIs */}
          <div className="mt-3 flex gap-2.5">
            <div className="flex-1 rounded-2xl border border-neutral-100 bg-surface p-4 shadow-sm">
              <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted">Ventas</p>
              <p className="mt-1 font-serif text-2xl font-semibold tabular-nums text-ink">{data.count}</p>
            </div>
            <div className="flex-1 rounded-2xl border border-neutral-100 bg-surface p-4 shadow-sm">
              <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted">Ticket medio</p>
              <p className="mt-1 font-serif text-2xl font-semibold tabular-nums text-ink">{money(data.ticketMedio)}</p>
            </div>
          </div>

          {/* Por canal */}
          {data.porCanal.length > 0 && (
            <>
              <div className="mb-3 mt-6 flex items-baseline justify-between">
                <h2 className="font-serif text-lg font-semibold text-ink">Por canal</h2>
                <span className="text-[12px] font-semibold uppercase tracking-wide text-gold-text">Origen</span>
              </div>
              <div className="flex flex-col gap-4 rounded-[18px] border border-neutral-100 bg-surface p-4 shadow-sm">
                {data.porCanal.map((c, i) => {
                  const Icono = c.canal === "sin_canal" ? HelpCircle : ICONO_CANAL[c.canal as Canal];
                  return (
                    <div key={c.canal}>
                      <div className="flex items-center gap-2.5">
                        <Icono size={17} strokeWidth={1.7} className="text-teal-800" />
                        <span className="flex-1 text-[14px] font-medium text-ink">{labelCanal(c.canal)}</span>
                        <span className="text-[14px] font-semibold tabular-nums text-ink">{money(c.importe)}</span>
                        <span className="w-9 text-right text-[12px] text-muted">{c.pct}%</span>
                      </div>
                      <div className="mt-2 h-[7px] overflow-hidden rounded bg-neutral-100">
                        <div className={cn("h-full rounded", BARRA_CANAL[i % BARRA_CANAL.length])} style={{ width: `${c.pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Por responsable */}
          <h2 className="mb-3 mt-6 font-serif text-lg font-semibold text-ink">Por responsable</h2>
          <div className="overflow-hidden rounded-[18px] border border-neutral-100 bg-surface shadow-sm">
            {data.porResponsable.map((r, i) => (
              <div key={r.nombre + i}>
                {i > 0 && <div className="mx-4 h-px bg-neutral-100" />}
                <div className="flex items-center gap-3 p-3.5">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gold-tint">
                    <span className="font-serif text-[14px] font-semibold text-gold-700">
                      {r.nombre.trim().charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-semibold text-ink">{r.nombre}</p>
                    <p className="mt-0.5 text-[12px] text-muted">{r.count} {r.count === 1 ? "venta" : "ventas"}</p>
                  </div>
                  <span className="text-[15px] font-semibold tabular-nums text-ink">{money(r.importe)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Ventas recientes */}
          <h2 className="mb-3 mt-6 font-serif text-lg font-semibold text-ink">Ventas recientes</h2>
          <div className="flex flex-col gap-2.5">
            {data.recientes.map((v) => {
              const d = diasDesde(v.fecha, ahora);
              const cuando = d <= 0 ? "Hoy" : d === 1 ? "Ayer" : fechaCortaES(v.fecha, negocio.zonaHoraria);
              const Icono = v.canal ? ICONO_CANAL[v.canal] : HelpCircle;
              return (
                <div key={v._id} className="rounded-2xl border border-neutral-100 bg-surface p-3.5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[14.5px] font-semibold text-ink">{v.clienteNombre}</span>
                    <span className="text-[15px] font-bold tabular-nums text-teal-800">{money(v.importe)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="flex items-center gap-1 rounded-lg bg-neutral-50 px-2 py-0.5">
                      <Icono size={11} strokeWidth={2} className="text-teal-800" />
                      <span className="text-[11px] font-semibold text-teal-800">{v.canal ? LABELS.canal[v.canal] : "—"}</span>
                    </span>
                    <span className="text-[12px] text-muted">{v.responsableNombre.split(" ")[0]} · {cuando}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Vacio() {
  return (
    <div className="flex flex-col items-center px-8 pt-20 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-[24px] border border-[#E0C795] bg-[#F4ECDB]">
        <Trophy size={38} strokeWidth={1.5} className="text-gold-500" />
      </div>
      <p className="text-[16px] font-semibold text-ink">Aún no hay ventas</p>
      <p className="mt-1.5 text-[13px] text-muted">Registra tu primera venta desde la ficha de un cliente.</p>
      <Link
        href="/clientes"
        className="mt-5 rounded-[24px] border border-border-input bg-surface px-[18px] py-2.5 text-[14px] font-semibold text-ink shadow-sm active:scale-[0.99]"
      >
        Ir a clientes
      </Link>
    </div>
  );
}

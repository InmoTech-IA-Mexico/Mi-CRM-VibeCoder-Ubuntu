"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import {
  ChevronLeft, Trophy, XCircle, Percent, TrendingUp, Tag, Repeat, AlertTriangle, Info,
} from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { useSesion } from "@/components/session/use-sesion";
import { rangoPeriodoEnZona } from "@/lib/fechas";
import { cn } from "@/lib/utils";

// Resumen del mes (JUA-34). Solo admin. Métricas de oportunidades cerradas del
// período (ganadas/perdidas), ingresos estimados, tasa de conversión y desglose
// por modelo de venta. Rango calculado en la zona horaria del negocio.
const money = (n: number) => "$" + new Intl.NumberFormat("es-MX").format(n);

export function PantallaResumen() {
  const router = useRouter();
  const { token, negocio, rol } = useSesion();
  const esAdmin = rol === "admin";

  const [ahora] = useState(() => Date.now());
  const [periodo, setPeriodo] = useState<"mes" | "anterior" | "año">("mes");

  const rangoMes = useMemo(() => rangoPeriodoEnZona("mes", negocio.zonaHoraria, ahora), [negocio.zonaHoraria, ahora]);
  const rangoAnio = useMemo(() => rangoPeriodoEnZona("año", negocio.zonaHoraria, ahora), [negocio.zonaHoraria, ahora]);
  const PERIODOS = useMemo(
    () => [
      { key: "mes" as const, label: "Este mes", desde: rangoMes.desde, hasta: rangoMes.hasta },
      { key: "anterior" as const, label: "Mes anterior", desde: rangoMes.desdePrev, hasta: rangoMes.hastaPrev },
      { key: "año" as const, label: "Este año", desde: rangoAnio.desde, hasta: rangoAnio.hasta },
    ],
    [rangoMes, rangoAnio],
  );
  const sel = PERIODOS.find((p) => p.key === periodo)!;

  const data = useQuery(
    api.oportunidades.reporteMensual,
    esAdmin ? { token, desde: sel.desde, hasta: sel.hasta } : "skip",
  );

  useEffect(() => {
    if (!esAdmin) router.replace("/inicio");
  }, [esAdmin, router]);

  if (!esAdmin) return null;

  const vacio = data && data.totalCerradas === 0;

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
        <h1 className="font-serif text-xl font-semibold text-ink">Resumen del mes</h1>
        <div className="w-11" />
      </header>

      {/* Chips de periodo */}
      <div className="flex gap-2 px-4 pt-1 pb-3">
        {PERIODOS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriodo(p.key)}
            className={cn(
              "rounded-pill px-3.5 py-1.5 text-[13px] font-medium transition active:scale-95",
              periodo === p.key ? "bg-ink text-white" : "border border-border-input bg-surface text-body",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {data === undefined ? (
        <p className="px-4 py-10 text-center text-[14px] text-muted">Cargando…</p>
      ) : vacio ? (
        <div className="flex flex-1 flex-col items-center justify-center px-11 pb-24 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100">
            <Trophy size={26} strokeWidth={1.7} className="text-neutral-400" />
          </div>
          <p className="font-serif text-lg font-semibold text-ink">Sin cierres en este período</p>
          <p className="mt-2 text-[13.5px] text-muted">
            Aquí verás las oportunidades ganadas y perdidas cuando marques cierres en el pipeline.
          </p>
        </div>
      ) : data ? (
        <div className="flex flex-col gap-5 px-4 pb-10">
          {/* Hero: ingresos estimados */}
          <div className="rounded-[22px] bg-gradient-to-br from-[#0E2E34] to-[#16454C] p-5 text-white shadow-lg">
            <p className="text-[12.5px] font-medium text-[#9FC1C0]">Ingresos estimados · {sel.label.toLowerCase()}</p>
            <p className="mt-1 font-serif text-[34px] font-semibold tabular-nums tracking-tight">
              {money(data.ingresosEstimados)}
            </p>
            <p className="mt-1 text-[12.5px] text-[#B9D3D2]">
              {data.ganadas.count} {data.ganadas.count === 1 ? "venta ganada" : "ventas ganadas"} en el período
            </p>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <Kpi icon={Trophy} tono="verde" valor={data.ganadas.count} etiqueta="Ganadas" />
            <Kpi icon={XCircle} tono="rojo" valor={data.perdidas.count} etiqueta="Perdidas" />
            <Kpi
              icon={Percent}
              tono="dorado"
              valor={data.tasaConversion == null ? "—" : `${data.tasaConversion}%`}
              etiqueta="Conversión"
            />
          </div>

          {/* Aviso de ganadas sin monto */}
          {data.ganadas.sinMonto > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-[#E0C795] bg-[#F9F1DF] px-3 py-2.5">
              <AlertTriangle size={16} strokeWidth={1.9} className="mt-0.5 flex-shrink-0 text-[#9A7327]" />
              <p className="text-[12.5px] leading-snug text-[#8A6420]">
                {data.ganadas.sinMonto} {data.ganadas.sinMonto === 1 ? "oportunidad ganada no tiene" : "oportunidades ganadas no tienen"} monto
                estimado — no suman a los ingresos.
              </p>
            </div>
          )}

          {/* Por modelo de venta */}
          <section>
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gold-text">Por modelo de venta</p>
            <div className="flex flex-col gap-2.5">
              <FilaModelo icon={Tag} label="Pago único" data={data.porModelo.find((m) => m.modelo === "unico")!} />
              <FilaModelo icon={Repeat} label="Recurrente / suscripción" data={data.porModelo.find((m) => m.modelo === "recurrente")!} />
              {data.ganadasSinModelo > 0 && (
                <p className="flex items-center gap-1.5 px-1 text-[12px] text-muted">
                  <Info size={13} strokeWidth={1.8} />
                  {data.ganadasSinModelo} sin modelo especificado
                </p>
              )}
            </div>
          </section>

          {/* Motivos de pérdida */}
          {data.perdidas.motivos.length > 0 && (
            <section>
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gold-text">
                Motivos de pérdida más frecuentes
              </p>
              <div className="flex flex-col gap-2">
                {data.perdidas.motivos.map((m) => (
                  <div
                    key={m.motivo}
                    className="flex items-center justify-between rounded-xl border border-neutral-100 bg-surface px-3.5 py-2.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{m.motivo}</span>
                    <span className="ml-3 flex-shrink-0 rounded-pill bg-neutral-100 px-2 py-0.5 text-[11.5px] font-semibold text-body">
                      {m.count}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Kpi({
  icon: Icon,
  tono,
  valor,
  etiqueta,
}: {
  icon: typeof Trophy;
  tono: "verde" | "rojo" | "dorado";
  valor: number | string;
  etiqueta: string;
}) {
  const color = tono === "verde" ? "text-teal-800" : tono === "rojo" ? "text-danger" : "text-gold-700";
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-neutral-100 bg-surface p-3.5 shadow-sm">
      <Icon size={18} strokeWidth={1.9} className={color} />
      <span className="font-serif text-[22px] font-semibold tabular-nums text-ink">{valor}</span>
      <span className="text-[11.5px] text-muted">{etiqueta}</span>
    </div>
  );
}

function FilaModelo({
  icon: Icon,
  label,
  data,
}: {
  icon: typeof Tag;
  label: string;
  data: { count: number; monto: number };
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-surface p-3.5 shadow-sm">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gold-tint">
        <Icon size={18} strokeWidth={1.8} className="text-gold-700" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-ink">{label}</p>
        <p className="text-[12.5px] text-muted">{data.count} {data.count === 1 ? "ganada" : "ganadas"}</p>
      </div>
      <span className="flex items-center gap-1 font-serif text-[15px] font-semibold tabular-nums text-teal-800">
        <TrendingUp size={13} strokeWidth={2} />
        {money(data.monto)}
      </span>
    </div>
  );
}

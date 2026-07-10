"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ChevronLeft, Bell, ShieldCheck, CalendarClock } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { useSesion } from "@/components/session/use-sesion";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { EsqueletoLista } from "@/components/ui/esqueleto-lista";
import { IndicadorPrioridad, bordePrioridadClase } from "@/components/ui/indicador-prioridad";
import { LABELS } from "@/lib/enums";
import { fechaCortaES } from "@/lib/fechas";
import { cn } from "@/lib/utils";

type Panel = NonNullable<FunctionReturnType<typeof api.seguimientos.panelSupervision>>;
type Grupo = Panel["grupos"][number];
type Item = Grupo["items"][number];

export function PantallaSupervision() {
  const router = useRouter();
  const { token, rol, negocio } = useSesion();
  const esAdmin = rol === "admin";

  useEffect(() => {
    if (!esAdmin) router.replace("/inicio");
  }, [esAdmin, router]);

  const panel = useQuery(api.seguimientos.panelSupervision, esAdmin ? { token } : "skip");

  return (
    <div className="flex min-h-full flex-col">
      <header className="relative flex h-14 items-center justify-center px-3.5">
        <button
          type="button"
          aria-label="Volver"
          onClick={() => router.back()}
          className="absolute left-3.5 flex h-11 w-11 items-center justify-center rounded-xl border border-border-input bg-surface shadow-sm active:scale-95"
        >
          <ChevronLeft size={20} strokeWidth={2} className="text-ink" />
        </button>
        <h1 className="font-serif text-xl font-semibold text-ink">Panel de supervisión</h1>
      </header>

      <div className="flex flex-col gap-4 px-4 pt-2 pb-10">
        <p className="flex items-start gap-2 px-1 text-[12.5px] leading-snug text-muted">
          <ShieldCheck size={15} strokeWidth={1.8} className="mt-0.5 flex-shrink-0 text-gold-text" />
          Seguimientos pendientes que has delegado en el equipo. Cada uno aparece también en la agenda de su
          responsable.
        </p>

        {panel === undefined ? (
          <EsqueletoLista />
        ) : panel === null ? null : panel.grupos.length === 0 ? (
          <EstadoVacio
            tono="exito"
            icono={<ShieldCheck size={32} strokeWidth={1.6} className="text-success" />}
            titulo="Nada delegado pendiente"
            subtitulo="Cuando asignes un seguimiento a un miembro del equipo, aparecerá aquí"
          />
        ) : (
          <>
            {/* Resumen */}
            <div className="flex gap-2.5">
              <Metrica valor={panel.totalPendientes} etiqueta="pendientes" />
              <Metrica valor={panel.totalVencidos} etiqueta="vencidos" tono={panel.totalVencidos > 0 ? "danger" : "normal"} />
              <Metrica valor={panel.totalEmpleados} etiqueta={panel.totalEmpleados === 1 ? "miembro" : "miembros"} />
            </div>

            {panel.grupos.map((g) => (
              <GrupoEmpleado key={g.usuarioId} grupo={g} tz={negocio.zonaHoraria} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function Metrica({ valor, etiqueta, tono = "normal" }: { valor: number; etiqueta: string; tono?: "normal" | "danger" }) {
  return (
    <div className="flex-1 rounded-[16px] border border-neutral-100 bg-surface p-3.5 text-center shadow-sm">
      <p className={cn("font-serif text-2xl font-bold tabular-nums", tono === "danger" ? "text-danger" : "text-ink")}>
        {valor}
      </p>
      <p className="mt-0.5 text-[11.5px] font-medium text-muted">{etiqueta}</p>
    </div>
  );
}

function GrupoEmpleado({ grupo, tz }: { grupo: Grupo; tz: string }) {
  const inicial = grupo.nombre.trim().charAt(0).toUpperCase() || "?";
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2.5 px-0.5">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full font-serif text-[15px] font-semibold",
            grupo.rol === "admin" ? "bg-gradient-to-br from-[#D2B074] to-[#B68E45] text-white" : "bg-[#E2EDEE] text-[#1C4E55]",
          )}
        >
          {inicial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink">{grupo.nombre}</p>
          <p className="text-[12px] text-muted">
            {LABELS.rol[grupo.rol as "admin" | "operativo"]} · {grupo.total} pendiente{grupo.total === 1 ? "" : "s"}
            {grupo.vencidos > 0 && <span className="font-semibold text-danger"> · {grupo.vencidos} vencido{grupo.vencidos === 1 ? "" : "s"}</span>}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {grupo.items.map((it) => (
          <TarjetaItem key={it._id} item={it} tz={tz} />
        ))}
      </div>
    </section>
  );
}

function TarjetaItem({ item, tz }: { item: Item; tz: string }) {
  const cuando = `${fechaCortaES(item.fecha, tz)}${item.hora ? ` · ${item.hora}` : ""}`;
  const contenido = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {item.vencido && (
            <span className="flex items-center gap-1 rounded-lg bg-[#F6E7E0] px-2 py-0.5">
              <span className="h-[5px] w-[5px] rounded-full bg-danger" />
              <span className="text-[10.5px] font-semibold text-[#8A3F2C]">Vencido</span>
            </span>
          )}
          <span className={cn("text-[12px] font-semibold tabular-nums", item.vencido ? "text-danger" : "text-muted")}>{cuando}</span>
          {item.notificar && <Bell size={12} strokeWidth={2} className="text-[#1C4E55]" aria-label="Notificado" />}
        </div>
        <p className="mt-1 break-words text-[14.5px] font-semibold text-ink">{item.titulo}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="min-w-0 break-words text-[12.5px] text-muted">{item.subtitulo}</span>
          <IndicadorPrioridad prioridad={item.prioridad} />
        </div>
      </div>
      {!item.clienteId && <CalendarClock size={16} strokeWidth={1.7} className="flex-shrink-0 text-neutral-300" />}
    </>
  );
  const clase = cn(
    "flex items-center gap-3 rounded-card border border-l-[3px] border-neutral-100 bg-surface p-3.5 shadow-sm",
    bordePrioridadClase(item.prioridad),
  );
  // Si es de cliente, enlaza a su ficha; si es tarea personal del empleado, no navega.
  return item.clienteId ? (
    <Link href={`/clientes/${item.clienteId}`} className={cn(clase, "active:scale-[0.99]")}>
      {contenido}
    </Link>
  ) : (
    <div className={clase}>{contenido}</div>
  );
}

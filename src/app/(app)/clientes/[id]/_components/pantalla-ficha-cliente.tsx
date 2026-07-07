"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import {
  Phone,
  Calendar,
  FileText,
  Bell,
  CalendarClock,
  Plus,
  Clock,
  Inbox,
  MessagesSquare,
} from "lucide-react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { useSesion } from "@/components/session/use-sesion";
import { LABELS, type EtapaPipeline } from "@/lib/enums";
import { fechaCortaES } from "@/lib/fechas";
import { bordePrioridadClase } from "@/components/ui/indicador-prioridad";
import { cn } from "@/lib/utils";
import { CabeceraFicha } from "./cabecera-ficha";
import { TarjetaPerfil } from "./tarjeta-perfil";

const COLOR_ETAPA: Record<EtapaPipeline, string> = {
  nueva: "bg-[#80847B]",
  en_contacto: "bg-[#2E6E78]",
  propuesta: "bg-[#0E2E34]",
  negociacion: "bg-[#C9A25E]",
  ganada: "bg-success",
  perdida: "bg-danger",
  cancelada: "bg-neutral-400",
};

export function PantallaFichaCliente({ clienteId }: { clienteId: Id<"clientes"> }) {
  const { token, negocio, rol } = useSesion();
  const [ahora] = useState(() => Date.now());
  const cliente = useQuery(api.clientes.detalle, { token, clienteId });

  if (cliente === undefined) return <FichaCargando />;
  if (cliente === null) return <FichaNoEncontrada />;

  const base = `/clientes/${clienteId}`;

  return (
    <div className="flex min-h-full flex-col">
      <CabeceraFicha
        clienteId={clienteId}
        nombre={cliente.nombre}
        estado={cliente.estado}
        esAdmin={rol === "admin"}
        token={token}
      />

      <div className="flex flex-col gap-[18px] px-4 pt-2 pb-8">
        <TarjetaPerfil cliente={cliente} ahora={ahora} />

        {/* Acciones rápidas */}
        <div className="flex gap-2">
          <AccionRapida
            href={cliente.telefono ? `tel:${cliente.telefono.replace(/\s/g, "")}` : `${base}/nota`}
            icon={Phone}
            label="Llamada"
            externa={!!cliente.telefono}
          />
          <AccionRapida href={`${base}/recordatorio`} icon={Calendar} label="Reunión" />
          <AccionRapida href={`${base}/nota`} icon={FileText} label="Nota" />
          <AccionRapida href={`${base}/recordatorio`} icon={Bell} label="Recordatorio" />
        </div>

        {/* Acciones principales */}
        <div className="flex gap-2.5">
          <Link
            href={`${base}/recordatorio`}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-border-input bg-surface text-[13.5px] font-semibold text-ink shadow-sm active:scale-[0.99]"
          >
            <CalendarClock size={18} strokeWidth={1.7} />
            Programar seguimiento
          </Link>
          <Link
            href={`${base}/oportunidad`}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gold-500 text-[13.5px] font-bold text-ink shadow-[0_2px_8px_rgba(201,162,94,0.32)] active:scale-[0.99]"
          >
            <Plus size={18} strokeWidth={2} />
            Nueva oportunidad
          </Link>
        </div>

        {/* Seguimientos pendientes */}
        <Seccion titulo="Seguimientos pendientes" contador={cliente.seguimientos.length}>
          {cliente.seguimientos.length === 0 ? (
            <EstadoVacio icono={Clock} texto="Sin seguimientos programados" />
          ) : (
            <div className="flex flex-col gap-2.5">
              {cliente.seguimientos.map((s) => (
                <div
                  key={s._id}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border border-l-[3px] border-neutral-100 bg-surface p-3.5 shadow-sm",
                    bordePrioridadClase(s.prioridad),
                  )}
                >
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-[#F4ECDB]">
                    <Clock size={17} strokeWidth={1.7} className="text-[#9A7327]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-ink">{s.titulo}</p>
                    <p className="mt-0.5 text-[12px] font-semibold text-gold-700">
                      {fechaCortaES(s.fecha, negocio.zonaHoraria)}
                      {s.hora ? ` · ${s.hora}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Seccion>

        {/* Oportunidades (solo lectura; gestión completa en Fase 4) */}
        <Seccion
          titulo="Oportunidades"
          accion={
            <Link
              href={`${base}/oportunidad`}
              aria-label="Nueva oportunidad"
              className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-gold-500 shadow-[0_2px_8px_rgba(201,162,94,0.32)] active:scale-95"
            >
              <Plus size={16} strokeWidth={2.2} className="text-ink" />
            </Link>
          }
        >
          {cliente.oportunidades.length === 0 ? (
            <EstadoVacio icono={Inbox} texto="Sin oportunidades abiertas" />
          ) : (
            <div className="flex flex-col gap-2.5">
              {cliente.oportunidades.map((o) => (
                <div key={o._id} className="rounded-2xl border border-neutral-100 bg-surface p-3.5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[14.5px] font-semibold text-ink">{o.nombre}</span>
                    <span className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-neutral-50 px-2.5 py-1">
                      <span className={cn("h-1.5 w-1.5 rounded-full", COLOR_ETAPA[o.etapa])} />
                      <span className="text-[11px] font-semibold text-body">{LABELS.etapa[o.etapa]}</span>
                    </span>
                  </div>
                  {(o.monto != null || o.fechaCierre != null) && (
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[15px] font-semibold tabular-nums text-teal-800">
                        {o.monto != null ? `$${new Intl.NumberFormat("es-MX").format(o.monto)}` : ""}
                      </span>
                      {o.fechaCierre != null && (
                        <span className="text-[12px] text-muted">
                          Cierre {fechaCortaES(o.fechaCierre, negocio.zonaHoraria)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Seccion>

        {/* Historial — se construye en Fase 3 (notas/interacciones) */}
        <Seccion titulo="Historial">
          <div className="flex flex-col items-center rounded-[18px] border border-neutral-100 bg-surface px-6 py-7 text-center shadow-sm">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-100 bg-neutral-50">
              <MessagesSquare size={24} strokeWidth={1.5} className="text-neutral-400" />
            </div>
            <p className="text-[14.5px] font-semibold text-body">Historial de interacciones</p>
            <p className="mt-1 max-w-[240px] text-[12.5px] leading-snug text-muted">
              Las notas e interacciones se añadirán aquí (Fase 3).
            </p>
          </div>
        </Seccion>
      </div>
    </div>
  );
}

function AccionRapida({
  href,
  icon: Icon,
  label,
  externa,
}: {
  href: string;
  icon: typeof Phone;
  label: string;
  externa?: boolean;
}) {
  const clase =
    "flex flex-1 flex-col items-center gap-1.5 rounded-xl border border-neutral-100 bg-surface py-2.5 shadow-sm active:scale-95";
  const contenido = (
    <>
      <Icon size={20} strokeWidth={1.6} className="text-[#1C4E55]" />
      <span className="text-[11px] font-semibold text-body">{label}</span>
    </>
  );
  return externa ? (
    <a href={href} className={clase}>
      {contenido}
    </a>
  ) : (
    <Link href={href} className={clase}>
      {contenido}
    </Link>
  );
}

function Seccion({
  titulo,
  contador,
  accion,
  children,
}: {
  titulo: string;
  contador?: number;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h3 className="font-serif text-lg font-semibold text-ink">{titulo}</h3>
          {contador != null && contador > 0 && (
            <span className="text-[12px] font-semibold uppercase tracking-wide text-gold-text">
              {contador} {contador === 1 ? "activo" : "activos"}
            </span>
          )}
        </div>
        {accion}
      </div>
      {children}
    </section>
  );
}

function EstadoVacio({ icono: Icono, texto }: { icono: typeof Clock; texto: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-neutral-100 bg-surface px-6 py-6 text-center shadow-sm">
      <div className="mb-3 flex h-[52px] w-[52px] items-center justify-center rounded-[14px] border border-neutral-100 bg-neutral-50">
        <Icono size={24} strokeWidth={1.6} className="text-neutral-400" />
      </div>
      <p className="text-[14px] font-semibold text-body">{texto}</p>
    </div>
  );
}

function FichaCargando() {
  return (
    <div className="flex min-h-full flex-col">
      <div className="h-14" />
      <div className="flex flex-col gap-[18px] px-4 pt-2">
        <div className="h-56 animate-pulse rounded-[18px] bg-neutral-100" />
        <div className="h-16 animate-pulse rounded-xl bg-neutral-100" />
        <div className="h-32 animate-pulse rounded-2xl bg-neutral-100" />
      </div>
    </div>
  );
}

function FichaNoEncontrada() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <p className="font-serif text-xl font-semibold text-ink">Cliente no encontrado</p>
      <p className="text-[13.5px] text-muted">
        No existe o no pertenece a tu negocio.
      </p>
      <Link
        href="/clientes"
        className="mt-2 rounded-[22px] border border-border-input bg-surface px-5 py-2.5 text-[14px] font-semibold text-ink shadow-sm"
      >
        Volver a clientes
      </Link>
    </div>
  );
}

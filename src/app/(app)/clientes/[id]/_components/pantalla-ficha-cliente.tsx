"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
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
  Mail,
  MessageSquare,
  MapPin,
  Lock,
  Trash2,
  Trophy,
} from "lucide-react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { useSesion } from "@/components/session/use-sesion";
import { LABELS, type EtapaPipeline, type TipoInteraccion } from "@/lib/enums";
import { fechaCortaES, diasDesde } from "@/lib/fechas";
import { bordePrioridadClase } from "@/components/ui/indicador-prioridad";
import { cn } from "@/lib/utils";
import { CabeceraFicha } from "./cabecera-ficha";
import { TarjetaPerfil } from "./tarjeta-perfil";
import { HojaOportunidad, type ItemOportunidad } from "./hoja-oportunidad";
import { HojaRegistrarVenta } from "./hoja-registrar-venta";

const COLOR_ETAPA: Record<EtapaPipeline, string> = {
  nueva: "bg-[#80847B]",
  en_contacto: "bg-[#2E6E78]",
  propuesta: "bg-[#0E2E34]",
  negociacion: "bg-[#C9A25E]",
  ganada: "bg-success",
  perdida: "bg-danger",
  cancelada: "bg-neutral-400",
};

const ICONO_TIPO: Record<TipoInteraccion, typeof Phone> = {
  llamada: Phone,
  reunion: Calendar,
  correo: Mail,
  mensaje: MessageSquare,
  visita: MapPin,
  interno: Lock,
};

export function PantallaFichaCliente({ clienteId }: { clienteId: Id<"clientes"> }) {
  const { token, negocio, rol } = useSesion();
  const [ahora] = useState(() => Date.now());
  const cliente = useQuery(api.clientes.detalle, { token, clienteId });
  const eliminarNota = useMutation(api.notas.eliminar);
  const [oportunidadSel, setOportunidadSel] = useState<ItemOportunidad | null>(null);
  const [ventaAbierta, setVentaAbierta] = useState(false);

  if (cliente === undefined) return <FichaCargando />;
  if (cliente === null) return <FichaNoEncontrada />;

  const base = `/clientes/${clienteId}`;
  const esAdmin = rol === "admin";
  // Oportunidad activa más reciente (la primera no cerrada; `detalle` viene en
  // orden descendente) → se destaca en la lista.
  const activaId = cliente.oportunidades.find(
    (o) => !["ganada", "perdida", "cancelada"].includes(o.etapa),
  )?._id;
  // Historial = notas + ventas, en orden cronológico inverso (JUA-18 + JUA-110).
  const historial = [
    ...cliente.notas.map((n) => ({ kind: "nota" as const, fecha: n.fecha, nota: n })),
    ...cliente.ventas.map((vt) => ({ kind: "venta" as const, fecha: vt.fecha, venta: vt })),
  ].sort((a, b) => b.fecha - a.fecha);
  const onEliminarNota = async (notaId: Id<"notas">) => {
    if (!window.confirm("¿Eliminar esta nota? No se puede deshacer.")) return;
    try {
      await eliminarNota({ token, notaId });
    } catch (error) {
      console.error("No se pudo eliminar la nota", error);
    }
  };

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
          <button
            type="button"
            onClick={() => setVentaAbierta(true)}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gold-500 text-[13.5px] font-bold text-ink shadow-[0_2px_8px_rgba(201,162,94,0.32)] active:scale-[0.99]"
          >
            <Trophy size={18} strokeWidth={1.9} />
            Registrar venta
          </button>
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
              {cliente.oportunidades.map((o) => {
                const activa = o._id === activaId;
                return (
                  <button
                    key={o._id}
                    type="button"
                    onClick={() => setOportunidadSel(o)}
                    className={cn(
                      "block w-full rounded-2xl border border-l-[3px] border-neutral-100 bg-surface p-3.5 text-left shadow-sm transition active:scale-[0.99]",
                      activa ? "border-l-gold-500" : "border-l-neutral-100",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0 truncate text-[14.5px] font-semibold text-ink">{o.nombre}</span>
                        {activa && (
                          <span className="flex-shrink-0 rounded bg-gold-tint px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-gold-700">
                            Activa
                          </span>
                        )}
                      </span>
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
                  </button>
                );
              })}
            </div>
          )}
        </Seccion>

        {/* Historial: notas + ventas (JUA-18 + JUA-110) */}
        <Seccion titulo="Historial">
          {historial.length === 0 ? (
            <div className="flex flex-col items-center rounded-[18px] border border-neutral-100 bg-surface px-6 py-7 text-center shadow-sm">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-100 bg-neutral-50">
                <MessagesSquare size={24} strokeWidth={1.5} className="text-neutral-400" />
              </div>
              <p className="text-[14.5px] font-semibold text-body">Sin interacciones registradas</p>
              <p className="mt-1 max-w-[240px] text-[12.5px] leading-snug text-muted">
                Añade una nota después de hablar con {cliente.nombre.split(" ")[0]}.
              </p>
            </div>
          ) : (
            <div className="rounded-[18px] border border-neutral-100 bg-surface p-4 shadow-sm">
              {historial.map((item, i) => {
                const d = diasDesde(item.fecha, ahora);
                const cuando = d <= 0 ? "Hoy" : d === 1 ? "Ayer" : `Hace ${d} días`;
                const ultimo = i === historial.length - 1;
                if (item.kind === "venta") {
                  const vt = item.venta;
                  return (
                    <div key={vt._id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px] bg-[#E2EFEB]">
                          <Trophy size={16} strokeWidth={1.7} className="text-success" />
                        </div>
                        {!ultimo && <div className="mt-1 w-0.5 flex-1 bg-neutral-100" />}
                      </div>
                      <div className={cn("min-w-0 flex-1", !ultimo && "pb-4")}>
                        <div className="flex items-center gap-2">
                          <span className="text-[11.5px] text-muted">{cuando}</span>
                          <span className="rounded-md bg-[#E2EFEB] px-1.5 py-0.5 text-[10px] font-semibold text-[#1B5446]">Venta</span>
                        </div>
                        <p className="mt-1 text-[14px] leading-relaxed text-ink">
                          Venta registrada{vt.oportunidadNombre ? ` — ${vt.oportunidadNombre}` : ""}{" "}
                          <span className="font-bold tabular-nums text-teal-800">
                            ${new Intl.NumberFormat("es-MX").format(vt.importe)}
                          </span>
                        </p>
                        <p className="mt-1.5 text-[12px] text-muted">{vt.registradoPorNombre}</p>
                      </div>
                    </div>
                  );
                }
                const n = item.nota;
                const Icono = ICONO_TIPO[n.tipo];
                const interno = n.tipo === "interno";
                return (
                  <div key={n._id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          "flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px]",
                          interno ? "bg-teal-900" : "bg-neutral-50",
                        )}
                      >
                        <Icono size={16} strokeWidth={1.7} className={interno ? "text-[#F3ECDC]" : "text-teal-800"} />
                      </div>
                      {!ultimo && <div className="mt-1 w-0.5 flex-1 bg-neutral-100" />}
                    </div>
                    <div className={cn("min-w-0 flex-1", !ultimo && "pb-4")}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11.5px] text-muted">{cuando}</span>
                          {interno ? (
                            <span className="rounded-md bg-teal-900 px-1.5 py-0.5 text-[10px] font-semibold text-[#F3ECDC]">
                              Interno
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium text-gold-700">
                              {LABELS.tipoInteraccion[n.tipo]}
                            </span>
                          )}
                        </div>
                        {esAdmin && (
                          <button
                            type="button"
                            aria-label="Eliminar nota"
                            onClick={() => onEliminarNota(n._id)}
                            className="-mr-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-neutral-400 active:scale-90 active:text-danger"
                          >
                            <Trash2 size={13} strokeWidth={1.9} />
                          </button>
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ink">
                        {n.descripcion}
                      </p>
                      {n.resultado && (
                        <span className="mt-1.5 inline-block rounded-md bg-neutral-50 px-2 py-0.5 text-[11.5px] font-medium text-body">
                          {n.resultado}
                        </span>
                      )}
                      <p className="mt-1.5 text-[12px] text-muted">{n.autorNombre}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Seccion>
      </div>

      {oportunidadSel && (
        <HojaOportunidad
          oportunidad={oportunidadSel}
          token={token}
          esAdmin={esAdmin}
          onClose={() => setOportunidadSel(null)}
        />
      )}

      {ventaAbierta && (
        <HojaRegistrarVenta
          clienteId={clienteId}
          nombre={cliente.nombre}
          oportunidades={cliente.oportunidades}
          token={token}
          onClose={() => setVentaAbierta(false)}
        />
      )}
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

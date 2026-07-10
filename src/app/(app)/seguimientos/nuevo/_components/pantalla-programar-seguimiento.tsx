"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  X, Bell, Calendar, Clock, AlertCircle, Repeat, User, Users, ChevronRight, Check, Search, ShieldCheck, Info,
} from "lucide-react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { useSesion } from "@/components/session/use-sesion";
import { HojaInferior } from "@/components/ui/hoja-inferior";
import { FRECUENCIAS, LABELS, type Frecuencia, type Prioridad } from "@/lib/enums";
import { epochDesdeFechaHora } from "@/lib/fechas";
import { cn } from "@/lib/utils";

// Pantalla "Programar seguimiento" (JUA-119). Un seguimiento puede dirigirse a un
// CLIENTE (aparece en la agenda del negocio) o a un EMPLEADO (tarea que atiende ese
// empleado y aparece en su agenda). Reasignar a otro miembro del equipo es solo del
// admin; el backend valida el permiso igualmente.
type Cliente = FunctionReturnType<typeof api.clientes.listar>[number];
type Equipo = NonNullable<FunctionReturnType<typeof api.usuarios.equipo>>;
type Miembro = Equipo["usuarios"][number];
type Destino = "cliente" | "empleado";
type Sheet = "cliente" | "empleado" | "responsable" | null;

const PRIORIDADES: { key: Prioridad; punto: string }[] = [
  { key: "alta", punto: "bg-[#B0573F]" },
  { key: "media", punto: "bg-[#C9A25E]" },
  { key: "baja", punto: "bg-[#80847B]" },
];

const inicial = (nombre: string) => nombre.trim().charAt(0).toUpperCase() || "?";

export function PantallaProgramarSeguimiento() {
  const { token } = useSesion();
  const clientes = useQuery(api.clientes.listar, { token });
  const equipo = useQuery(api.usuarios.equipo, { token });

  if (clientes === undefined || equipo === undefined) {
    return (
      <div className="flex flex-col gap-5 px-4 pt-16">
        <div className="h-12 animate-pulse rounded-[14px] bg-neutral-100" />
        <div className="h-20 animate-pulse rounded-[18px] bg-neutral-100" />
        <div className="h-40 animate-pulse rounded-[18px] bg-neutral-100" />
      </div>
    );
  }
  if (equipo === null) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-8 text-center">
        <p className="font-serif text-xl font-semibold text-ink">No autorizado</p>
      </div>
    );
  }

  return <Formulario token={token} clientes={clientes} equipo={equipo} />;
}

function Formulario({ token, clientes, equipo }: { token: string; clientes: Cliente[]; equipo: Equipo }) {
  const router = useRouter();
  const { negocio } = useSesion();
  const crear = useMutation(api.seguimientos.crear);

  const yo = equipo.usuarios.find((u) => u.esYo) ?? null;

  const [destino, setDestino] = useState<Destino>("cliente");
  const [clienteId, setClienteId] = useState<Id<"clientes"> | null>(null);
  // Empleado destinatario: por defecto uno mismo (un operativo solo puede asignarse
  // a sí mismo; el admin puede elegir a cualquiera).
  const [empleadoId, setEmpleadoId] = useState<Id<"usuarios"> | null>(equipo.soyAdmin ? null : (yo?._id ?? null));
  // Responsable de un seguimiento a cliente: por defecto quien lo crea; el admin
  // puede redirigirlo a otro miembro del equipo.
  const [responsableId, setResponsableId] = useState<Id<"usuarios">>(equipo.miId);
  const [notificar, setNotificar] = useState(true);

  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [prioridad, setPrioridad] = useState<Prioridad>("media");
  const [frecuencia, setFrecuencia] = useState<Frecuencia>("una_vez");
  const [fechaFin, setFechaFin] = useState("");

  const [sheet, setSheet] = useState<Sheet>(null);
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cliente = clienteId ? clientes.find((c) => c._id === clienteId) ?? null : null;
  const empleado = empleadoId ? equipo.usuarios.find((u) => u._id === empleadoId) ?? null : null;
  const responsable = equipo.usuarios.find((u) => u._id === responsableId) ?? yo;

  const destinoOk = destino === "cliente" ? clienteId != null : empleadoId != null;
  const valido = titulo.trim().length > 0 && fecha.length > 0 && destinoOk;

  const guardar = async () => {
    if (guardando) return;
    if (!valido) return setIntentado(true);
    setGuardando(true);
    setError(null);
    try {
      const recurrente = frecuencia !== "una_vez";
      // Fecha de fin inclusiva: fin del día seleccionado (JUA-115).
      const finDeDia = fechaFin
        ? epochDesdeFechaHora(fechaFin, "", negocio.zonaHoraria) + 24 * 60 * 60 * 1000 - 1
        : undefined;
      await crear({
        token,
        destino,
        clienteId: destino === "cliente" ? (clienteId ?? undefined) : undefined,
        empleadoId: destino === "empleado" ? (empleadoId ?? undefined) : undefined,
        // Solo se envía responsable si el admin lo redirige a otro (cliente).
        responsableId:
          destino === "cliente" && equipo.soyAdmin && responsableId !== equipo.miId ? responsableId : undefined,
        notificar: destino === "empleado" ? notificar : undefined,
        titulo,
        fecha: epochDesdeFechaHora(fecha, hora, negocio.zonaHoraria),
        hora: hora || undefined,
        descripcion: descripcion.trim() || undefined,
        prioridad,
        frecuencia,
        fechaFin: recurrente ? finDeDia : undefined,
        diaRecurrencia: frecuencia === "mensual" ? Number(fecha.split("-")[2]) : undefined,
      });
      router.replace("/inicio");
    } catch (e) {
      console.error("No se pudo programar el seguimiento", e);
      setError("No se pudo programar el seguimiento. Inténtalo de nuevo.");
      setGuardando(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="relative flex h-14 items-center justify-center px-3.5">
        <button
          type="button"
          aria-label="Cancelar"
          onClick={() => router.back()}
          className="absolute left-3.5 flex h-11 w-11 items-center justify-center rounded-xl border border-border-input bg-surface shadow-sm active:scale-95"
        >
          <X size={20} strokeWidth={2} className="text-ink" />
        </button>
        <h1 className="font-serif text-xl font-semibold text-ink">Programar seguimiento</h1>
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
        {/* Tipo de destino: cliente / empleado */}
        <div className="flex gap-1.5 rounded-[14px] border border-[#E0D9C9] bg-[#F0ECE2] p-1.5">
          <BotonSegmento
            activo={destino === "cliente"}
            icon={User}
            label="Cliente"
            onClick={() => {
              setDestino("cliente");
              setIntentado(false);
            }}
          />
          <BotonSegmento
            activo={destino === "empleado"}
            icon={Users}
            label="Empleado"
            onClick={() => {
              setDestino("empleado");
              setIntentado(false);
            }}
          />
        </div>

        {/* Selector de cliente o empleado */}
        {destino === "cliente" ? (
          <Seccion titulo="Cliente" requerido invalido={intentado && !clienteId}>
            <TarjetaSeleccion
              vacio={!cliente}
              onClick={() => setSheet("cliente")}
              avatar={cliente ? inicial(cliente.nombre) : "?"}
              avatarClase="bg-[#F4ECDB] text-gold-700"
              titulo={cliente ? cliente.nombre : "Selecciona un cliente"}
              subtitulo={cliente?.empresa ?? undefined}
            />
          </Seccion>
        ) : (
          <Seccion titulo="Empleado" requerido invalido={intentado && !empleadoId}>
            <TarjetaSeleccion
              vacio={!empleado}
              // Un operativo solo puede crearse tareas a sí mismo → no abre selector.
              onClick={equipo.soyAdmin ? () => setSheet("empleado") : undefined}
              avatar={empleado ? inicial(empleado.nombre) : "?"}
              avatarClase="bg-[#E2EDEE] text-[#1C4E55]"
              titulo={empleado ? empleado.nombre : "Selecciona un empleado"}
              subtitulo={empleado ? subtituloMiembro(empleado) : undefined}
            />
          </Seccion>
        )}

        {/* Seguimiento: título */}
        <Seccion titulo="Seguimiento">
          <div className="rounded-[18px] border border-neutral-100 bg-surface p-4 shadow-sm">
            <p className="mb-2 text-[13px] font-medium text-ink">
              Título <span className="text-danger">*</span>
            </p>
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
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej: Llamar para revisar propuesta"
                aria-label="Título del seguimiento"
                className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
              />
            </div>
          </div>
        </Seccion>

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

        {/* Asignar seguimiento a (solo admin, destino cliente) — Variante 1/3 */}
        {destino === "cliente" && equipo.soyAdmin && (
          <div>
            <div className="mb-3 flex items-center gap-1.5">
              <ShieldCheck size={13} strokeWidth={1.9} className="text-gold-text" />
              <span className="text-[12px] font-semibold uppercase tracking-wider text-gold-text">Asignar seguimiento a</span>
            </div>
            <button
              type="button"
              onClick={() => setSheet("responsable")}
              className="flex w-full items-center gap-3 rounded-[18px] border border-neutral-100 bg-surface p-4 text-left shadow-sm active:scale-[0.99]"
            >
              <Avatar nombre={responsable?.nombre ?? "?"} clase="bg-gradient-to-br from-[#D2B074] to-[#B68E45] text-white" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-semibold text-ink">{responsable?.nombre ?? "—"}</span>
                  {responsable?.esYo && (
                    <span className="rounded-md bg-[#F0ECE2] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#80847B]">Tú</span>
                  )}
                </div>
                <p className="mt-0.5 text-[12.5px] text-muted">{responsable ? LABELS.rol[responsable.rol] : ""}</p>
              </div>
              <span className="flex-shrink-0 text-[12.5px] font-semibold text-gold-text">Cambiar</span>
            </button>
            <p className="mt-2 px-1 text-[12px] leading-snug text-muted">
              Puedes redirigir este seguimiento a otro miembro del equipo.
            </p>
          </div>
        )}

        {/* Notificar al empleado (destino empleado, si es otra persona) — Variante 2 */}
        {destino === "empleado" && empleado && !empleado.esYo && (
          <>
            <label className="flex cursor-pointer items-center gap-3 rounded-[18px] border border-neutral-100 bg-surface p-4 shadow-sm">
              <Bell size={20} strokeWidth={1.6} className="text-[#1C4E55]" />
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-semibold text-ink">Notificar a {empleado.nombre.split(" ")[0]}</p>
                <p className="mt-0.5 text-[12px] text-muted">Aparecerá destacado en su agenda</p>
              </div>
              <Interruptor activo={notificar} onClick={() => setNotificar((v) => !v)} />
            </label>
            <div className="flex items-start gap-2 px-1">
              <Info size={15} strokeWidth={1.8} className="mt-0.5 flex-shrink-0 text-muted" />
              <span className="text-[12px] leading-snug text-muted">
                Este seguimiento aparecerá en la agenda de {empleado.nombre.split(" ")[0]}. En el MVP no hay notificaciones push.
              </span>
            </div>
          </>
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

        {error && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-danger/30 bg-[#F9ECE7] p-3.5">
            <AlertCircle size={18} strokeWidth={1.9} className="flex-shrink-0 text-danger" />
            <p className="text-[13px] font-medium text-[#8A3F2C]">{error}</p>
          </div>
        )}
      </div>

      {/* Selector de cliente */}
      <HojaSeleccionCliente
        abierta={sheet === "cliente"}
        clientes={clientes}
        seleccionadoId={clienteId}
        onCerrar={() => setSheet(null)}
        onElegir={(id) => {
          setClienteId(id);
          setSheet(null);
        }}
      />

      {/* Selector de empleado (solo admin) */}
      <HojaSeleccionEquipo
        abierta={sheet === "empleado"}
        titulo="Selecciona un empleado"
        descripcion="Se le asignará este seguimiento en su agenda"
        miembros={equipo.usuarios}
        seleccionadoId={empleadoId}
        textoConfirmar="Asignar empleado"
        onCerrar={() => setSheet(null)}
        onConfirmar={(id) => {
          setEmpleadoId(id as Id<"usuarios">);
          setSheet(null);
        }}
      />

      {/* Redirigir responsable (solo admin, destino cliente) — Variante 3 */}
      <HojaSeleccionEquipo
        abierta={sheet === "responsable"}
        titulo="Asignar seguimiento a"
        descripcion={cliente ? `Elige quién dará seguimiento a ${cliente.nombre}` : "Elige el responsable del seguimiento"}
        miembros={equipo.usuarios}
        seleccionadoId={responsableId}
        textoConfirmar="Confirmar responsable"
        onCerrar={() => setSheet(null)}
        onConfirmar={(id) => {
          setResponsableId(id as Id<"usuarios">);
          setSheet(null);
        }}
      />
    </div>
  );
}

function subtituloMiembro(m: Miembro) {
  return `${LABELS.rol[m.rol]} · ${m.clientes} ${m.clientes === 1 ? "cliente" : "clientes"}`;
}

function BotonSegmento({
  activo,
  icon: Icon,
  label,
  onClick,
}: {
  activo: boolean;
  icon: typeof User;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] text-[14px] transition",
        activo ? "border-[1.5px] border-gold-500 bg-surface font-semibold text-gold-700 shadow-sm" : "font-medium text-body",
      )}
    >
      <Icon size={17} strokeWidth={1.8} />
      {label}
    </button>
  );
}

function Seccion({
  titulo,
  requerido,
  invalido,
  children,
}: {
  titulo: string;
  requerido?: boolean;
  invalido?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-gold-text">{titulo}</span>
        {requerido && <span className="text-[12px] font-semibold text-danger">*</span>}
        {invalido && <span className="text-[11.5px] font-medium normal-case text-danger">— requerido</span>}
      </div>
      {children}
    </div>
  );
}

function TarjetaSeleccion({
  vacio,
  onClick,
  avatar,
  avatarClase,
  titulo,
  subtitulo,
}: {
  vacio: boolean;
  onClick?: () => void;
  avatar: string;
  avatarClase: string;
  titulo: string;
  subtitulo?: string;
}) {
  const contenido = (
    <>
      <div className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-serif text-[16px] font-semibold", avatarClase)}>
        {avatar}
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[15px] font-semibold", vacio ? "text-muted" : "text-ink")}>{titulo}</p>
        {subtitulo && <p className="mt-0.5 truncate text-[12.5px] text-muted">{subtitulo}</p>}
      </div>
      {onClick && <ChevronRight size={18} strokeWidth={1.8} className="flex-shrink-0 text-neutral-400" />}
    </>
  );
  const clase = "flex w-full items-center gap-3 rounded-[18px] border border-neutral-100 bg-surface p-3.5 text-left shadow-sm";
  if (!onClick) return <div className={clase}>{contenido}</div>;
  return (
    <button type="button" onClick={onClick} className={cn(clase, "active:scale-[0.99]")}>
      {contenido}
    </button>
  );
}

function Avatar({ nombre, clase }: { nombre: string; clase: string }) {
  return (
    <div className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-serif text-[16px] font-semibold", clase)}>
      {inicial(nombre)}
    </div>
  );
}

function Interruptor({ activo, onClick }: { activo: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn(
        "flex h-[27px] w-[46px] flex-shrink-0 items-center rounded-full p-[3px] transition",
        activo ? "justify-end bg-gold-500" : "justify-start bg-neutral-200",
      )}
    >
      <span className="h-[21px] w-[21px] rounded-full bg-white shadow-[0_1px_3px_rgba(14,46,52,0.25)]" />
    </button>
  );
}

function HojaSeleccionCliente({
  abierta,
  clientes,
  seleccionadoId,
  onCerrar,
  onElegir,
}: {
  abierta: boolean;
  clientes: Cliente[];
  seleccionadoId: Id<"clientes"> | null;
  onCerrar: () => void;
  onElegir: (id: Id<"clientes">) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) => c.nombre.toLowerCase().includes(q) || (c.empresa ?? "").toLowerCase().includes(q),
    );
  }, [clientes, busqueda]);

  return (
    <HojaInferior
      abierta={abierta}
      onCerrar={onCerrar}
      titulo={<p className="font-serif text-lg font-semibold text-ink">Selecciona un cliente</p>}
    >
      <div className="flex flex-col gap-3">
        <div className="flex h-11 items-center gap-2 rounded-xl border border-border-input bg-surface px-3">
          <Search size={17} strokeWidth={1.8} className="text-neutral-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar cliente"
            aria-label="Buscar cliente"
            className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
          />
        </div>
        <div className="-mx-1 flex max-h-[46vh] flex-col gap-2 overflow-y-auto px-1">
          {filtrados.length === 0 ? (
            <p className="py-8 text-center text-[13.5px] text-muted">Sin clientes que coincidan.</p>
          ) : (
            filtrados.map((c) => {
              const activo = c._id === seleccionadoId;
              return (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => onElegir(c._id)}
                  className={cn(
                    "flex items-center gap-3 rounded-[14px] border p-3 text-left transition active:scale-[0.99]",
                    activo ? "border-[1.5px] border-gold-500 bg-gold-tint" : "border-border-input bg-surface",
                  )}
                >
                  <Avatar nombre={c.nombre} clase="bg-[#F4ECDB] text-gold-700" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink">{c.nombre}</p>
                    {c.empresa && <p className="mt-0.5 truncate text-[12.5px] text-muted">{c.empresa}</p>}
                  </div>
                  {activo && <Check size={18} strokeWidth={2.4} className="flex-shrink-0 text-gold-700" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </HojaInferior>
  );
}

function HojaSeleccionEquipo({
  abierta,
  titulo,
  descripcion,
  miembros,
  seleccionadoId,
  textoConfirmar,
  onCerrar,
  onConfirmar,
}: {
  abierta: boolean;
  titulo: string;
  descripcion: string;
  miembros: Miembro[];
  seleccionadoId: string | null;
  textoConfirmar: string;
  onCerrar: () => void;
  onConfirmar: (id: string) => void;
}) {
  const [elegidoId, setElegidoId] = useState<string | null>(seleccionadoId);
  // Reinicia la selección local cada vez que se abre (parte del valor actual).
  const [prevAbierta, setPrevAbierta] = useState(abierta);
  if (abierta !== prevAbierta) {
    setPrevAbierta(abierta);
    if (abierta) setElegidoId(seleccionadoId);
  }

  return (
    <HojaInferior
      abierta={abierta}
      onCerrar={onCerrar}
      titulo={
        <div>
          <p className="font-serif text-xl font-semibold text-ink">{titulo}</p>
          <p className="mt-1 text-[13px] leading-snug text-body">{descripcion}</p>
        </div>
      }
    >
      <div className="flex flex-col gap-2.5 pt-1">
        <div className="-mx-1 flex max-h-[42vh] flex-col gap-2 overflow-y-auto px-1">
          {miembros.map((m) => {
            const activo = m._id === elegidoId;
            return (
              <button
                key={m._id}
                type="button"
                onClick={() => setElegidoId(m._id)}
                className={cn(
                  "flex items-center gap-3 rounded-[14px] border p-3 text-left transition active:scale-[0.99]",
                  activo ? "border-[1.5px] border-gold-500 bg-[#F4ECDB]" : "border-border-input bg-surface",
                )}
              >
                <Avatar
                  nombre={m.nombre}
                  clase={m.rol === "admin" ? "bg-gradient-to-br from-[#D2B074] to-[#B68E45] text-white" : "bg-[#E2EDEE] text-[#1C4E55]"}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-semibold text-ink">{m.nombre}</span>
                    {m.esYo && (
                      <span className="rounded-md bg-[#F0ECE2] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#80847B]">Tú</span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[12.5px] text-muted">{subtituloMiembro(m)}</p>
                </div>
                <span
                  className={cn(
                    "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-[1.5px]",
                    activo ? "border-gold-500 bg-gold-500" : "border-[#CFC6B2]",
                  )}
                >
                  {activo && <Check size={14} strokeWidth={2.6} className="text-white" />}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={!elegidoId}
          onClick={() => elegidoId && onConfirmar(elegidoId)}
          className="mt-1 flex h-12 w-full items-center justify-center rounded-2xl bg-gold-500 text-[15px] font-bold text-ink shadow-[0_2px_8px_rgba(201,162,94,0.32)] transition active:scale-[0.99] disabled:opacity-60"
        >
          {textoConfirmar}
        </button>
      </div>
    </HojaInferior>
  );
}

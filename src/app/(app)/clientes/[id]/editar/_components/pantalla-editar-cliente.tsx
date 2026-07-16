"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { X, User, Phone, Mail, Building2, MessageCircle, Globe, Users, Radio, AlertCircle, Megaphone, CalendarDays, Store, Ellipsis, MapPin } from "lucide-react";
import { api } from "../../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../../convex/_generated/dataModel";
import { useSesion, useGuardEscritura } from "@/components/session/use-sesion";
import { LABELS, type Canal, type FuenteContacto, type Prioridad } from "@/lib/enums";
import { cn } from "@/lib/utils";

type Cliente = NonNullable<FunctionReturnType<typeof api.clientes.detalle>>;

const CANALES: { key: Canal; icon: typeof MessageCircle }[] = [
  { key: "whatsapp", icon: MessageCircle },
  { key: "email", icon: Mail },
  { key: "web", icon: Globe },
  { key: "telefono", icon: Phone },
  { key: "referido", icon: Users },
  { key: "redes", icon: Radio },
];

const PRIORIDADES: { key: Prioridad; punto: string }[] = [
  { key: "alta", punto: "bg-[#B0573F]" },
  { key: "media", punto: "bg-[#C9A25E]" },
  { key: "baja", punto: "bg-[#80847B]" },
];

// Fuente de contacto (JUA-38): icono + placeholder contextual para el detalle.
const FUENTES: { key: FuenteContacto; icon: typeof Users; placeholder: string }[] = [
  { key: "referido", icon: Users, placeholder: "¿Quién lo refirió? (ej. Ana García)" },
  { key: "campana", icon: Megaphone, placeholder: "¿Qué campaña? (ej. Black Friday 2026)" },
  { key: "evento", icon: CalendarDays, placeholder: "¿Qué evento? (ej. Feria junio 2026)" },
  { key: "visita", icon: Store, placeholder: "¿Dónde? (ej. mostrador sucursal centro)" },
  { key: "otro", icon: Ellipsis, placeholder: "Detalle de la fuente" },
];

export function PantallaEditarCliente({ clienteId }: { clienteId: Id<"clientes"> }) {
  const { token } = useSesion();
  const puedeEditar = useGuardEscritura();
  const cliente = useQuery(api.clientes.detalle, { token, clienteId });

  if (!puedeEditar) return null; // observador: el guard ya redirige a Inicio (JUA-42)
  if (cliente === undefined) {
    return (
      <div className="flex flex-col gap-5 px-4 pt-16">
        <div className="h-40 animate-pulse rounded-[18px] bg-neutral-100" />
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

function Formulario({
  clienteId,
  cliente,
  token,
}: {
  clienteId: Id<"clientes">;
  cliente: Cliente;
  token: string;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState(cliente.nombre);
  const [telefono, setTelefono] = useState(cliente.telefono ?? "");
  const [email, setEmail] = useState(cliente.email ?? "");
  const [empresa, setEmpresa] = useState(cliente.empresa ?? "");
  const [canal, setCanal] = useState<Canal | null>(cliente.canal ?? null);
  const [fuenteTipo, setFuenteTipo] = useState<FuenteContacto | null>(cliente.fuenteTipo ?? null);
  const [fuenteDetalle, setFuenteDetalle] = useState(cliente.fuenteDetalle ?? "");
  const [prioridad, setPrioridad] = useState<Prioridad>(cliente.prioridad ?? "media");
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const actualizar = useMutation(api.clientes.actualizar);

  const nombreOk = nombre.trim().length > 0;
  const contactoOk = telefono.trim().length > 0 || email.trim().length > 0;
  const valido = nombreOk && contactoOk;
  const volver = `/clientes/${clienteId}`;

  const guardar = async () => {
    if (guardando) return;
    if (!valido) return setIntentado(true);
    setGuardando(true);
    setErrorGuardar(null);
    try {
      await actualizar({
        token,
        clienteId,
        nombre,
        telefono,
        email,
        empresa,
        canal: canal ?? undefined,
        fuenteTipo: fuenteTipo ?? undefined,
        fuenteDetalle: fuenteTipo ? fuenteDetalle : undefined,
        prioridad,
      });
      router.replace(volver);
    } catch (error) {
      console.error("No se pudo guardar el cliente", error);
      setErrorGuardar("No se pudieron guardar los cambios. Revisa la conexión e inténtalo de nuevo.");
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
        <h1 className="font-serif text-[19px] font-semibold text-ink">Editar cliente</h1>
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
        {/* Datos básicos */}
        <Seccion titulo="Datos básicos">
          <div className="p-4">
            <Etiqueta obligatorio>Nombre completo</Etiqueta>
            <Input
              icon={User}
              label="Nombre completo"
              value={nombre}
              onChange={setNombre}
              placeholder="Nombre del cliente"
              error={intentado && !nombreOk}
            />
            {intentado && !nombreOk && <TextoError>El nombre es obligatorio</TextoError>}
          </div>
          <Divisor />
          <div className="p-4">
            <Etiqueta>Teléfono</Etiqueta>
            <div className="flex gap-2">
              <div className="flex h-12 items-center rounded-xl border border-border-input bg-neutral-50 px-3">
                <span className="text-[15px] font-semibold text-ink">+52</span>
              </div>
              <div className="flex-1">
                <Input icon={Phone} label="Teléfono" value={telefono} onChange={setTelefono} placeholder="55 1234 5678" tabular inputMode="tel" />
              </div>
            </div>
          </div>
        </Seccion>

        {/* Información adicional */}
        <Seccion titulo="Información adicional">
          <div className="p-4">
            <Etiqueta>Email</Etiqueta>
            <Input icon={Mail} label="Email" value={email} onChange={setEmail} placeholder="cliente@empresa.mx" inputMode="email" />
          </div>
          <Divisor />
          <div className="p-4">
            <Etiqueta>Empresa</Etiqueta>
            <Input icon={Building2} label="Empresa" value={empresa} onChange={setEmpresa} placeholder="Nombre de la empresa" />
          </div>
        </Seccion>

        {intentado && nombreOk && !contactoOk && <TextoError>Indica al menos un teléfono o un email</TextoError>}

        {/* Canal */}
        <section>
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gold-text">
            ¿Cómo nos contactó?
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {CANALES.map(({ key, icon: Icon }) => {
              const activo = canal === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCanal(activo ? null : key)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border py-2.5 transition active:scale-95",
                    activo
                      ? "border-gold-500 bg-gold-tint shadow-[0_2px_10px_rgba(201,162,94,0.22)]"
                      : "border-border-input bg-surface",
                  )}
                >
                  <Icon size={19} strokeWidth={1.7} className={activo ? "text-gold-700" : "text-neutral-400"} />
                  <span className={cn("text-[12px] font-medium", activo ? "text-ink" : "text-body")}>
                    {LABELS.canal[key]}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Fuente de contacto (JUA-38): origen específico — categoría + detalle libre */}
        <section>
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gold-text">
            Fuente de contacto
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {FUENTES.map(({ key, icon: Icon }) => {
              const activo = fuenteTipo === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFuenteTipo(activo ? null : key)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border py-2.5 transition active:scale-95",
                    activo
                      ? "border-gold-500 bg-gold-tint shadow-[0_2px_10px_rgba(201,162,94,0.22)]"
                      : "border-border-input bg-surface",
                  )}
                >
                  <Icon size={19} strokeWidth={1.7} className={activo ? "text-gold-700" : "text-neutral-400"} />
                  <span className={cn("text-[12px] font-medium", activo ? "text-ink" : "text-body")}>
                    {LABELS.fuenteContacto[key]}
                  </span>
                </button>
              );
            })}
          </div>
          {fuenteTipo && (
            <div className="mt-2.5">
              <Input
                icon={MapPin}
                label="Detalle de la fuente"
                value={fuenteDetalle}
                onChange={setFuenteDetalle}
                placeholder={FUENTES.find((f) => f.key === fuenteTipo)?.placeholder ?? "Detalle"}
                maxLength={120}
              />
              <p className="mt-1.5 px-1 text-[12px] text-muted">
                Opcional. Ayuda a personalizar el primer contacto.
              </p>
            </div>
          )}
        </section>

        {/* Clasificación — Prioridad */}
        <section>
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gold-text">
            Clasificación
          </p>
          <div className="rounded-[18px] border border-neutral-100 bg-surface p-4 shadow-sm">
            <Etiqueta>Prioridad</Etiqueta>
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
        </section>

        {errorGuardar && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-danger/30 bg-[#F9ECE7] p-3.5">
            <AlertCircle size={18} strokeWidth={1.9} className="flex-shrink-0 text-danger" />
            <p className="text-[13px] font-medium text-[#8A3F2C]">{errorGuardar}</p>
          </div>
        )}

        <p className="px-1 text-[12px] leading-snug text-muted">
          El estado y la papelera se gestionan desde el menú de la ficha.
        </p>
      </div>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gold-text">{titulo}</p>
      <div className="overflow-hidden rounded-[18px] border border-neutral-100 bg-surface shadow-sm">{children}</div>
    </section>
  );
}

function Divisor() {
  return <div className="mx-4 h-px bg-neutral-100" />;
}

function Input({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  error,
  tabular,
  inputMode,
  maxLength,
}: {
  icon: typeof User;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  error?: boolean;
  tabular?: boolean;
  inputMode?: "tel" | "email";
  maxLength?: number;
}) {
  return (
    <div
      className={cn(
        "flex h-12 items-center gap-2.5 rounded-xl border px-3 transition",
        error
          ? "border-danger ring-[3px] ring-danger/15"
          : "border-border-input focus-within:border-gold-500 focus-within:ring-[3px] focus-within:ring-gold-500/[0.18]",
      )}
    >
      <Icon size={18} strokeWidth={1.6} className={error ? "text-danger" : "text-neutral-400"} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        maxLength={maxLength}
        inputMode={inputMode}
        autoCapitalize={inputMode === "email" ? "none" : undefined}
        className={cn("w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted", tabular && "tabular-nums")}
      />
    </div>
  );
}

function Etiqueta({ children, obligatorio }: { children: React.ReactNode; obligatorio?: boolean }) {
  return (
    <p className="mb-2 text-[13px] font-medium text-ink">
      {children}
      {obligatorio && <span className="text-danger"> *</span>}
    </p>
  );
}

function TextoError({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-danger">
      <AlertCircle size={14} strokeWidth={1.9} />
      {children}
    </p>
  );
}

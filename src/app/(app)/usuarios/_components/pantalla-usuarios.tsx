"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ChevronLeft, UserPlus, Mail, AlertCircle, Clock } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { useSesion } from "@/components/session/use-sesion";
import { HojaInferior } from "@/components/ui/hoja-inferior";
import { LABELS, ROLES, type Rol } from "@/lib/enums";
import { cn } from "@/lib/utils";

// Gestión de usuarios (JUA-29). Solo admin: lista el equipo + invitaciones,
// invita, reenvía, revoca (desactiva) y reactiva. El envío real del email y la
// aceptación de la invitación son JUA-8/9.

const BADGE_ESTADO: Record<string, string> = {
  activo: "bg-[#E4F0EC] text-teal-800",
  inactivo: "bg-neutral-100 text-muted",
  pendiente: "bg-gold-tint text-gold-700",
  expirada: "bg-[#F9ECE7] text-[#8A3F2C]",
};
const LABEL_ESTADO: Record<string, string> = {
  activo: "Activo",
  inactivo: "Inactivo",
  pendiente: "Pendiente",
  expirada: "Expirada",
};

export function PantallaUsuarios() {
  const router = useRouter();
  const { token, rol } = useSesion();
  const esAdmin = rol === "admin";

  const [invitarAbierto, setInvitarAbierto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const data = useQuery(api.usuarios.listar, esAdmin ? { token } : "skip");
  const reenviar = useMutation(api.usuarios.reenviar);
  const desactivar = useMutation(api.usuarios.desactivar);
  const reactivar = useMutation(api.usuarios.reactivar);

  useEffect(() => {
    if (!esAdmin) router.replace("/inicio");
  }, [esAdmin, router]);

  if (!esAdmin) return null;

  const usuarios = data?.usuarios ?? [];
  const invitaciones = data?.invitaciones ?? [];

  const accion = async (fn: () => Promise<unknown>, fallo: string) => {
    setAviso(null);
    try {
      await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message.replace(/^\[.*?\]\s*/, "") : "";
      console.error(fallo, e);
      setAviso(msg && !/Uncaught|Server Error/.test(msg) ? msg : fallo);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <header className="relative flex h-14 items-center justify-between px-4">
        <button
          type="button"
          aria-label="Volver"
          onClick={() => router.back()}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-input bg-surface shadow-sm active:scale-95"
        >
          <ChevronLeft size={20} strokeWidth={2} className="text-ink" />
        </button>
        <h1 className="font-serif text-xl font-semibold text-ink">Usuarios</h1>
        <button
          type="button"
          onClick={() => {
            setAviso(null);
            setInvitarAbierto(true);
          }}
          aria-label="Invitar usuario"
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-500 text-ink shadow-[0_2px_6px_rgba(201,162,94,0.32)] active:scale-95"
        >
          <UserPlus size={19} strokeWidth={2} />
        </button>
      </header>

      <div className="flex flex-col gap-6 px-4 pt-2 pb-10">
        {aviso && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-danger/30 bg-[#F9ECE7] p-3.5">
            <AlertCircle size={18} strokeWidth={1.9} className="flex-shrink-0 text-danger" />
            <p className="text-[13px] font-medium text-[#8A3F2C]">{aviso}</p>
          </div>
        )}

        {/* Equipo */}
        <section>
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gold-text">
            Equipo · {usuarios.length} {usuarios.length === 1 ? "usuario" : "usuarios"}
          </p>
          <div className="flex flex-col gap-2.5">
            {usuarios.map((u) => (
              <div key={u._id} className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-surface p-3.5 shadow-sm">
                <Avatar nombre={u.nombre} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[15px] font-semibold text-ink">{u.nombre}</p>
                    {u.esYo && <span className="rounded-pill bg-neutral-100 px-1.5 py-0.5 text-[10.5px] font-medium text-muted">Tú</span>}
                  </div>
                  <p className="truncate text-[12.5px] text-muted">{u.email}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-[11.5px] font-medium text-body">{LABELS.rol[u.rol]}</span>
                    <span className="text-neutral-300">·</span>
                    <Badge estado={u.estado} />
                  </div>
                </div>
                {!u.esYo && u.estado === "activo" && (
                  <BotonAccion tono="peligro" onClick={() => accion(() => desactivar({ token, usuarioId: u._id }), "No se pudo revocar el acceso.")}>
                    Revocar
                  </BotonAccion>
                )}
                {!u.esYo && u.estado === "inactivo" && (
                  <BotonAccion onClick={() => accion(() => reactivar({ token, usuarioId: u._id }), "No se pudo reactivar el usuario.")}>
                    Reactivar
                  </BotonAccion>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Invitaciones */}
        {invitaciones.length > 0 && (
          <section>
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gold-text">
              Invitaciones · {invitaciones.length}
            </p>
            <div className="flex flex-col gap-2.5">
              {invitaciones.map((i) => (
                <div key={i._id} className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-surface p-3.5 shadow-sm">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-neutral-50">
                    <Mail size={18} strokeWidth={1.7} className="text-neutral-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-medium text-ink">{i.nombre ?? i.email}</p>
                    {i.nombre && <p className="truncate text-[12.5px] text-muted">{i.email}</p>}
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="text-[11.5px] font-medium text-body">{LABELS.rol[i.rol]}</span>
                      <span className="text-neutral-300">·</span>
                      <Badge estado={i.estado} />
                      {i.estado === "pendiente" && (
                        <span className="flex items-center gap-1 text-[11.5px] text-muted">
                          <Clock size={12} strokeWidth={1.8} />
                          {i.diasRestantes} {i.diasRestantes === 1 ? "día" : "días"}
                        </span>
                      )}
                    </div>
                  </div>
                  <BotonAccion onClick={() => accion(() => reenviar({ token, invitacionId: i._id }), "No se pudo reenviar la invitación.")}>
                    Reenviar
                  </BotonAccion>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="px-1 text-[12px] leading-snug text-muted">
          Al invitar se crea una invitación válida <span className="font-semibold text-body">7 días</span>. El
          envío del email y la activación de la cuenta llegan con la siguiente entrega.
        </p>
      </div>

      <HojaInvitar
        abierta={invitarAbierto}
        token={token}
        onCerrar={() => setInvitarAbierto(false)}
      />
    </div>
  );
}

function Avatar({ nombre }: { nombre: string }) {
  return (
    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D2B074] to-[#B68E45]">
      <span className="font-serif text-base font-semibold text-white">{nombre.charAt(0).toUpperCase()}</span>
    </div>
  );
}

function Badge({ estado }: { estado: string }) {
  return (
    <span className={cn("rounded-pill px-2 py-0.5 text-[10.5px] font-semibold", BADGE_ESTADO[estado])}>
      {LABEL_ESTADO[estado]}
    </span>
  );
}

function BotonAccion({
  children,
  onClick,
  tono,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tono?: "peligro";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-shrink-0 rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold transition active:scale-95",
        tono === "peligro"
          ? "border-danger/30 text-danger active:bg-[#F9ECE7]"
          : "border-border-input text-body active:bg-row-hover",
      )}
    >
      {children}
    </button>
  );
}

/** Bottom sheet para invitar a un usuario (email + nombre opc. + rol). */
function HojaInvitar({
  abierta,
  token,
  onCerrar,
}: {
  abierta: boolean;
  token: string;
  onCerrar: () => void;
}) {
  const invitar = useMutation(api.usuarios.invitar);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [rolSel, setRolSel] = useState<Rol>("operativo");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  const enviar = async () => {
    if (guardando || !emailOk) return;
    setGuardando(true);
    setError(null);
    try {
      await invitar({ token, email, nombre: nombre.trim() || undefined, rol: rolSel });
      setEmail("");
      setNombre("");
      setRolSel("operativo");
      onCerrar();
    } catch (e) {
      const msg = e instanceof Error ? e.message.replace(/^\[.*?\]\s*/, "") : "";
      console.error("No se pudo invitar", e);
      setError(msg && !/Uncaught|Server Error/.test(msg) ? msg : "No se pudo enviar la invitación.");
      setGuardando(false);
    }
  };

  return (
    <HojaInferior
      abierta={abierta}
      onCerrar={onCerrar}
      titulo={
        <div>
          <p className="font-serif text-lg font-semibold text-ink">Invitar al equipo</p>
          <p className="text-[12.5px] text-muted">Recibirá un email con el enlace para activar su cuenta</p>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-1">
        <div>
          <p className="mb-2 text-[13px] font-medium text-ink">
            Email <span className="text-danger">*</span>
          </p>
          <div className="flex h-12 items-center gap-2.5 rounded-xl border border-border-input px-3 transition focus-within:border-gold-500 focus-within:ring-[3px] focus-within:ring-gold-500/[0.18]">
            <Mail size={18} strokeWidth={1.6} className="text-neutral-400" />
            <input
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@empresa.mx"
              inputMode="email"
              autoCapitalize="none"
              aria-label="Email del invitado"
              className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-ink">
            Nombre <span className="font-normal text-muted">(opcional)</span>
          </p>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del usuario"
            aria-label="Nombre del invitado"
            className="h-12 w-full rounded-xl border border-border-input px-3 text-[15px] text-ink outline-none transition focus:border-gold-500 focus:ring-[3px] focus:ring-gold-500/[0.18] placeholder:text-muted"
          />
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-ink">Rol</p>
          <div className="flex gap-2">
            {ROLES.map((r) => {
              const activo = rolSel === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRolSel(r)}
                  className={cn(
                    "flex-1 rounded-xl border py-2.5 text-[14px] font-medium transition active:scale-[0.98]",
                    activo ? "border-gold-500 bg-gold-tint text-gold-700" : "border-border-input bg-surface text-body",
                  )}
                >
                  {LABELS.rol[r]}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-[#F9ECE7] px-3 py-2.5">
            <AlertCircle size={16} strokeWidth={1.9} className="flex-shrink-0 text-danger" />
            <p className="text-[12.5px] font-medium text-[#8A3F2C]">{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={enviar}
          disabled={!emailOk || guardando}
          className={cn(
            "mt-1 flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-bold transition active:scale-[0.99]",
            emailOk ? "bg-gold-500 text-ink shadow-[0_2px_8px_rgba(201,162,94,0.32)]" : "cursor-not-allowed bg-neutral-100 text-muted",
          )}
        >
          {guardando ? "Enviando…" : "Enviar invitación"}
        </button>
      </div>
    </HojaInferior>
  );
}

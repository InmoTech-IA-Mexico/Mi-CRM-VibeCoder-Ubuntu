"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import {
  ChevronLeft, User, Mail, Lock, LogOut, ChevronRight, BarChart3, Users, Trash2, AlertCircle, Check,
} from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { useSesion } from "@/components/session/use-sesion";
import { LABELS } from "@/lib/enums";
import { cn } from "@/lib/utils";

const ACCESOS_ADMIN = [
  { label: "Resumen del mes", icon: BarChart3, href: "/resumen" },
  { label: "Gestión de usuarios", icon: Users, href: "/usuarios" },
  { label: "Papelera", icon: Trash2, href: "/papelera" },
];

// Extrae el mensaje de negocio de un error de mutation de Convex, cuyo `message`
// llega como "[CONVEX M(...)] … Server Error\nUncaught Error: <mensaje real>\n …".
const mensajeError = (e: unknown, fallback: string) => {
  const raw = e instanceof Error ? e.message : "";
  const m = raw.match(/Uncaught \w*Error:\s*(.+?)(?:\n|$)/);
  const msg = (m ? m[1] : raw).trim();
  return msg && !/^\[CONVEX|Server Error/.test(msg) ? msg : fallback;
};

export function PantallaPerfil() {
  const router = useRouter();
  const { token, usuario, rol, cerrarSesion } = useSesion();

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
        <h1 className="font-serif text-xl font-semibold text-ink">Perfil y ajustes</h1>
      </header>

      <div className="flex flex-col gap-5 px-4 pt-2 pb-10">
        {/* Cabecera de perfil */}
        <div className="flex flex-col items-center rounded-[18px] border border-neutral-100 bg-surface p-5 shadow-sm">
          <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-gradient-to-br from-[#D2B074] to-[#B68E45] shadow-[0_6px_18px_rgba(201,162,94,0.40)]">
            <span className="font-serif text-[28px] font-bold text-white">
              {usuario.nombre.charAt(0).toUpperCase()}
            </span>
          </div>
          <h2 className="mt-3 font-serif text-xl font-semibold text-ink">{usuario.nombre}</h2>
          <p className="mt-0.5 text-[13px] text-muted">{usuario.email}</p>
          <span className="mt-2 rounded-lg bg-[#F4ECDB] px-2.5 py-1 text-[12px] font-semibold text-[#9A7327]">
            {LABELS.rol[rol]}
          </span>
        </div>

        <DatosPersonales token={token} nombreActual={usuario.nombre} emailActual={usuario.email} />
        <CambiarPassword token={token} />

        {/* Accesos de administrador (solo Marta) */}
        {rol === "admin" && (
          <section>
            <p className="mb-3 px-1 text-[12px] font-semibold uppercase tracking-wider text-gold-text">
              Administración
            </p>
            <div className="overflow-hidden rounded-[18px] border border-neutral-100 bg-surface shadow-sm">
              {ACCESOS_ADMIN.map(({ label, icon: Icon, href }, i) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3.5 active:bg-row-hover",
                    i > 0 && "border-t border-neutral-100",
                  )}
                >
                  <Icon size={19} strokeWidth={1.7} className="text-body" />
                  <span className="flex-1 text-[15px] text-ink">{label}</span>
                  <ChevronRight size={17} className="text-muted" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Cerrar sesión (JUA-11) */}
        <button
          type="button"
          onClick={() => void cerrarSesion()}
          className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-danger/30 bg-[#F9ECE7] text-[15px] font-semibold text-danger active:scale-[0.99]"
        >
          <LogOut size={18} strokeWidth={2} />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

function DatosPersonales({ token, nombreActual, emailActual }: { token: string; nombreActual: string; emailActual: string }) {
  const actualizar = useMutation(api.usuarios.actualizarPerfil);
  const [nombre, setNombre] = useState(nombreActual);
  const [email, setEmail] = useState(emailActual);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const cambiado = nombre.trim() !== nombreActual || email.trim().toLowerCase() !== emailActual;
  const valido = nombre.trim().length > 0 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  const guardar = async () => {
    if (guardando || !cambiado || !valido) return;
    setGuardando(true);
    setError(null);
    setOk(false);
    try {
      await actualizar({ token, nombre, email });
      setOk(true);
    } catch (e) {
      console.error("No se pudo actualizar el perfil", e);
      setError(mensajeError(e, "No se pudo guardar. Inténtalo de nuevo."));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Tarjeta titulo="Datos personales">
      <Campo etiqueta="Nombre" icono={<User size={18} strokeWidth={1.6} className="text-neutral-400" />}>
        <input
          value={nombre}
          onChange={(e) => { setNombre(e.target.value); setOk(false); }}
          aria-label="Nombre"
          className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
        />
      </Campo>
      <Campo etiqueta="Email" icono={<Mail size={18} strokeWidth={1.6} className="text-neutral-400" />}>
        <input
          value={email}
          onChange={(e) => { setEmail(e.target.value); setOk(false); }}
          type="email"
          autoCapitalize="none"
          aria-label="Email"
          className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
        />
      </Campo>

      <Aviso error={error} ok={ok} okTexto="Datos actualizados" />

      <BotonGuardar
        onClick={guardar}
        disabled={!cambiado || !valido || guardando}
        ocupado={guardando}
        texto={guardando ? "Guardando…" : "Guardar cambios"}
      />
    </Tarjeta>
  );
}

function CambiarPassword({ token }: { token: string }) {
  const cambiar = useMutation(api.auth.cambiarPassword);
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const coincide = nueva === confirmar;
  const valido = actual.length > 0 && nueva.length >= 8 && coincide;

  const guardar = async () => {
    if (guardando) return;
    if (!valido) {
      setError(nueva.length < 8 ? "La nueva contraseña debe tener al menos 8 caracteres" : !coincide ? "Las contraseñas no coinciden" : "Completa los campos");
      return;
    }
    setGuardando(true);
    setError(null);
    setOk(false);
    try {
      await cambiar({ token, actual, nueva });
      setOk(true);
      setActual(""); setNueva(""); setConfirmar("");
    } catch (e) {
      console.error("No se pudo cambiar la contraseña", e);
      setError(mensajeError(e, "No se pudo cambiar la contraseña."));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Tarjeta titulo="Cambiar contraseña">
      <Campo etiqueta="Contraseña actual" icono={<Lock size={18} strokeWidth={1.6} className="text-neutral-400" />}>
        <input
          value={actual}
          onChange={(e) => { setActual(e.target.value); setOk(false); }}
          type="password"
          aria-label="Contraseña actual"
          className="w-full bg-transparent text-[15px] text-ink outline-none"
        />
      </Campo>
      <Campo etiqueta="Nueva contraseña" icono={<Lock size={18} strokeWidth={1.6} className="text-neutral-400" />}>
        <input
          value={nueva}
          onChange={(e) => { setNueva(e.target.value); setOk(false); }}
          type="password"
          aria-label="Nueva contraseña"
          placeholder="Mínimo 8 caracteres"
          className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
        />
      </Campo>
      <Campo etiqueta="Confirmar nueva contraseña" icono={<Lock size={18} strokeWidth={1.6} className="text-neutral-400" />}>
        <input
          value={confirmar}
          onChange={(e) => { setConfirmar(e.target.value); setOk(false); }}
          type="password"
          aria-label="Confirmar nueva contraseña"
          className="w-full bg-transparent text-[15px] text-ink outline-none"
        />
      </Campo>

      <Aviso error={error} ok={ok} okTexto="Contraseña actualizada" />

      <BotonGuardar
        onClick={guardar}
        disabled={guardando}
        ocupado={guardando}
        texto={guardando ? "Guardando…" : "Cambiar contraseña"}
      />
    </Tarjeta>
  );
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-3 px-1 text-[12px] font-semibold uppercase tracking-wider text-gold-text">{titulo}</p>
      <div className="flex flex-col gap-3 rounded-[18px] border border-neutral-100 bg-surface p-4 shadow-sm">
        {children}
      </div>
    </section>
  );
}

function Campo({ etiqueta, icono, children }: { etiqueta: string; icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-ink">{etiqueta}</p>
      <div className="flex h-12 items-center gap-2.5 rounded-xl border border-border-input px-3 transition focus-within:border-gold-500 focus-within:ring-[3px] focus-within:ring-gold-500/[0.18]">
        {icono}
        {children}
      </div>
    </div>
  );
}

function Aviso({ error, ok, okTexto }: { error: string | null; ok: boolean; okTexto: string }) {
  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-[#F9ECE7] px-3 py-2.5">
        <AlertCircle size={16} strokeWidth={1.9} className="flex-shrink-0 text-danger" />
        <p className="text-[12.5px] font-medium text-[#8A3F2C]">{error}</p>
      </div>
    );
  }
  if (ok) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[#2E7D6B]/30 bg-[#E2EFEB] px-3 py-2.5">
        <Check size={16} strokeWidth={2.2} className="flex-shrink-0 text-success" />
        <p className="text-[12.5px] font-medium text-[#2E6E5E]">{okTexto}</p>
      </div>
    );
  }
  return null;
}

function BotonGuardar({ onClick, disabled, ocupado, texto }: { onClick: () => void; disabled: boolean; ocupado: boolean; texto: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={ocupado}
      className="mt-1 flex h-12 w-full items-center justify-center rounded-xl bg-gold-500 text-[15px] font-bold text-ink shadow-[0_2px_8px_rgba(201,162,94,0.32)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {texto}
    </button>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import {
  ChevronLeft, User, Mail, Lock, LogOut, ChevronRight, BarChart3, Users, Trash2, AlertCircle, Check, ShieldCheck, Tag, Download,
} from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { useSesion } from "@/components/session/use-sesion";
import { BarraFortaleza } from "@/components/ui/barra-fortaleza";
import { TarjetaNotificaciones } from "@/components/push/tarjeta-notificaciones";
import { BotonGoogle, googleConfigurado } from "@/components/auth/boton-google";
import { LABELS } from "@/lib/enums";
import { cn } from "@/lib/utils";

const ACCESOS_ADMIN = [
  { label: "Resumen del mes", icon: BarChart3, href: "/resumen" },
  { label: "Panel de supervisión", icon: ShieldCheck, href: "/supervision" },
  { label: "Gestión de usuarios", icon: Users, href: "/usuarios" },
  { label: "Etiquetas de producto", icon: Tag, href: "/etiquetas" },
  { label: "Exportar datos", icon: Download, href: "/exportar-datos" },
  { label: "Papelera", icon: Trash2, href: "/papelera" },
];

// Extrae el mensaje de negocio de un error de mutation. Las validaciones de cara al
// usuario lanzan `ConvexError`, cuyo payload (`data`) sí llega al cliente también en
// producción (los mensajes de `Error` se ocultan en prod). Fallback en cualquier
// otro caso (error de red, etc.).
const mensajeError = (e: unknown, fallback: string) => {
  const data = e && typeof e === "object" && "data" in e ? (e as { data: unknown }).data : undefined;
  return typeof data === "string" && data.trim() ? data.trim() : fallback;
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

        {/* Cuenta de Google (JUA-40): vincular / estado. Solo si hay Client ID configurado. */}
        {googleConfigurado && <CuentaGoogle token={token} />}

        {/* Alerta push de cliente frío (JUA-33) */}
        <TarjetaNotificaciones />

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
      <BarraFortaleza password={nueva} className="!mt-0" />
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

// Cuenta de Google (JUA-40): muestra si está vinculada (sin exponer el `sub`) o el
// botón para vincular desde una sesión válida (prueba de control). El login por Google
// vive en /login; aquí solo se vincula/consulta.
function CuentaGoogle({ token }: { token: string }) {
  const estado = useQuery(api.google.estadoVinculo, { token });
  const desvincular = useMutation(api.google.desvincularGoogle);
  const [error, setError] = useState<string | null>(null);
  const [reciente, setReciente] = useState<boolean | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const vinculado = reciente ?? estado?.vinculado === true;

  const quitar = async () => {
    if (ocupado) return;
    // Confirmación breve para evitar una desvinculación accidental (obs. OBS-3).
    if (!window.confirm("¿Desvincular tu cuenta de Google? Podrás volver a vincularla cuando quieras.")) return;
    setOcupado(true);
    setError(null);
    try {
      await desvincular({ token });
      setReciente(false);
    } catch (e) {
      console.error("No se pudo desvincular Google", e);
      setError(mensajeError(e, "No se pudo desvincular. Inténtalo de nuevo."));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Tarjeta titulo="Cuenta de Google">
      {vinculado ? (
        <>
          <div className="flex items-center gap-2 rounded-xl border border-[#2E7D6B]/30 bg-[#E2EFEB] px-3 py-2.5">
            <Check size={16} strokeWidth={2.2} className="flex-shrink-0 text-success" />
            <p className="text-[12.5px] font-medium text-[#2E6E5E]">
              Tu cuenta está vinculada. Ya puedes entrar con &ldquo;Continuar con Google&rdquo;.
            </p>
          </div>
          <button
            type="button"
            onClick={quitar}
            disabled={ocupado}
            aria-busy={ocupado}
            className="h-10 w-full rounded-xl border border-border-input bg-surface text-[13.5px] font-semibold text-body active:scale-[0.99] disabled:opacity-50"
          >
            {ocupado ? "Desvinculando…" : "Desvincular Google"}
          </button>
          <Aviso error={error} ok={false} okTexto="" />
        </>
      ) : (
        <>
          <p className="text-[12.5px] leading-snug text-muted">
            Vincula tu cuenta de Google para iniciar sesión con ella, además de tu contraseña.
          </p>
          <BotonGoogle
            modo="vincular"
            token={token}
            onOk={() => { setReciente(true); setError(null); }}
            onError={(m) => setError(m)}
          />
          <Aviso error={error} ok={false} okTexto="" />
        </>
      )}
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

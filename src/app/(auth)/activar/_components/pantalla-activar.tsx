"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Lock, Eye, EyeOff, AlertCircle, Mail, Clock, Globe, Building2, CheckCircle2, Sparkles } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { guardarToken } from "@/components/session/session-provider";
import { BarraFortaleza } from "@/components/ui/barra-fortaleza";
import { ZONAS_MX } from "@/lib/fechas";
import { cn } from "@/lib/utils";

// Activación de cuenta desde invitación (JUA-8 admin / JUA-9 operativo). El
// admin además configura su negocio (nombre + zona horaria). Al activar se
// muestra la bienvenida y de ahí entra directo al CRM (sin pasar por Login).
// Diseño: Activacion Cuenta.dc.html.

export function PantallaActivar({ token }: { token: string }) {
  const router = useRouter();
  const info = useQuery(api.invitaciones.porToken, token ? { token } : "skip");
  const activar = useMutation(api.invitaciones.activar);

  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [zona, setZona] = useState<string>(ZONAS_MX[0].tz);
  // null = sin editar → se muestra el nombre del negocio existente (prefijado).
  const [nombreNegocioEdit, setNombreNegocioEdit] = useState<string | null>(null);
  const [ver, setVer] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Paso final tras activar. Se comprueba ANTES que el estado de la invitación:
  // al aceptarse, la query reactiva pasa a "aceptada" y taparía la bienvenida.
  const [bienvenida, setBienvenida] = useState<{ nombre: string; esAdmin: boolean; negocio: string | null } | null>(null);

  if (bienvenida)
    return <PantallaBienvenida {...bienvenida} onEmpezar={() => router.replace("/inicio")} />;

  if (!token) return <Mensaje tono="error" titulo="Enlace no válido" texto="Falta el código de invitación en el enlace." />;
  if (info === undefined) return <p className="text-center text-[14px] text-muted">Cargando…</p>;
  if (info.estado === "invalida")
    return <Mensaje tono="error" titulo="Enlace no válido" texto="Esta invitación no existe o ya no está disponible." />;
  if (info.estado === "aceptada")
    return (
      <Mensaje tono="ok" titulo="Cuenta ya activada" texto="Esta invitación ya se usó. Inicia sesión con tu email y contraseña.">
        <Link href="/login" className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-gold-500 text-[15px] font-bold text-ink shadow-[0_2px_8px_rgba(201,162,94,0.32)] active:scale-[0.99]">
          Ir a iniciar sesión
        </Link>
      </Mensaje>
    );
  if (info.estado === "expirada")
    return (
      <Mensaje tono="error" titulo="Este enlace ya no es válido" texto="El enlace de invitación ha expirado o ya fue usado. Pide a tu administrador que te envíe uno nuevo.">
        <Link href="/login" className="mt-5 text-[13.5px] font-medium text-teal-800 underline">
          Volver a iniciar sesión
        </Link>
      </Mensaje>
    );

  const requiereZona = info.requiereZona;
  const nombreNegocio = nombreNegocioEdit ?? info.negocioNombre ?? "";
  const pwdOk = password.length >= 8;
  const coincide = password.length > 0 && password === confirmar;
  const valido = pwdOk && coincide && (!requiereZona || !!zona);

  const enviar = async () => {
    if (cargando) return;
    if (!pwdOk) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (!coincide) return setError("Las contraseñas no coinciden.");
    setError(null);
    setCargando(true);
    try {
      const res = await activar({
        token,
        password,
        zonaHoraria: requiereZona ? zona : undefined,
        negocioNombre: requiereZona ? nombreNegocio.trim() || undefined : undefined,
      });
      guardarToken(res.token);
      setBienvenida({
        nombre: res.nombre,
        esAdmin: info.rol === "admin",
        negocio: (requiereZona ? nombreNegocio.trim() : "") || info.negocioNombre,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message.replace(/^\[.*?\]\s*/, "") : "";
      console.error("No se pudo activar la cuenta", e);
      setError(msg && !/Uncaught|Server Error/.test(msg) ? msg : "No se pudo activar la cuenta. Inténtalo de nuevo.");
      setCargando(false);
    }
  };

  return (
    <div className="w-full">
      <header className="mb-6 text-center">
        <h1 className="font-serif text-[26px] font-semibold text-ink">
          {info.nombre ? `Hola, ${info.nombre}` : "Activa tu cuenta"}
        </h1>
        <p className="mt-1.5 text-[13.5px] text-muted">
          {info.negocioNombre ? <>Te unes a <span className="font-medium text-body">{info.negocioNombre}</span>. </> : null}
          Crea tu contraseña para entrar al CRM.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
        className="flex flex-col gap-4"
      >
        {/* Email (bloqueado) */}
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-ink">Email</label>
          <div className="flex h-12 items-center gap-2.5 rounded-xl border border-border-input bg-neutral-50 px-3">
            <Mail size={18} strokeWidth={1.6} className="text-neutral-400" />
            <span className="truncate text-[15px] text-body">{info.email}</span>
          </div>
        </div>

        {/* Contraseña + medidor */}
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-ink">Nueva contraseña</label>
          <div className="flex h-12 items-center gap-2.5 rounded-xl border border-border-input px-3 transition focus-within:border-gold-500 focus-within:ring-[3px] focus-within:ring-gold-500/[0.18]">
            <Lock size={18} strokeWidth={1.6} className="text-neutral-400" />
            <input
              type={ver ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              autoCapitalize="none"
              aria-label="Nueva contraseña"
              className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
            />
            <button type="button" aria-label={ver ? "Ocultar" : "Mostrar"} onClick={() => setVer((v) => !v)} className="text-neutral-400">
              {ver ? <EyeOff size={18} strokeWidth={1.7} /> : <Eye size={18} strokeWidth={1.7} />}
            </button>
          </div>
          <BarraFortaleza password={password} />
        </div>

        {/* Confirmar */}
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-ink">Confirmar contraseña</label>
          <div className="flex h-12 items-center gap-2.5 rounded-xl border border-border-input px-3 transition focus-within:border-gold-500 focus-within:ring-[3px] focus-within:ring-gold-500/[0.18]">
            <Lock size={18} strokeWidth={1.6} className="text-neutral-400" />
            <input
              type={ver ? "text" : "password"}
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              placeholder="Repite la contraseña"
              autoCapitalize="none"
              aria-label="Confirmar contraseña"
              className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
            />
          </div>
          {confirmar.length > 0 && !coincide && (
            <p className="mt-1.5 text-[11.5px] font-medium text-danger">Las contraseñas no coinciden.</p>
          )}
        </div>

        {/* Datos del negocio (solo admin, JUA-8) */}
        {requiereZona && (
          <div className="rounded-2xl border border-neutral-100 bg-neutral-50/60 p-3.5">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gold-text">Datos del negocio</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-ink">Nombre del negocio</label>
                <div className="flex h-12 items-center gap-2.5 rounded-xl border border-border-input bg-surface px-3 transition focus-within:border-gold-500 focus-within:ring-[3px] focus-within:ring-gold-500/[0.18]">
                  <Building2 size={18} strokeWidth={1.6} className="text-neutral-400" />
                  <input
                    value={nombreNegocio}
                    onChange={(e) => setNombreNegocioEdit(e.target.value)}
                    placeholder="Nombre de tu inmobiliaria"
                    aria-label="Nombre del negocio"
                    className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-ink">
                  Zona horaria <span className="text-danger">*</span>
                </label>
                <div className="flex h-12 items-center gap-2.5 rounded-xl border border-border-input bg-surface px-3 transition focus-within:border-gold-500 focus-within:ring-[3px] focus-within:ring-gold-500/[0.18]">
                  <Globe size={18} strokeWidth={1.6} className="text-neutral-400" />
                  <select
                    value={zona}
                    onChange={(e) => setZona(e.target.value)}
                    aria-label="Zona horaria del negocio"
                    className="w-full bg-transparent text-[14.5px] text-ink outline-none"
                  >
                    {ZONAS_MX.map((z) => (
                      <option key={z.tz} value={z.tz}>
                        {z.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] leading-snug text-muted">
                  <Clock size={13} strokeWidth={1.8} className="mt-0.5 flex-shrink-0" />
                  Todas las fechas del CRM (agenda, recordatorios, inactividad) se calculan con esta zona.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-[#F9ECE7] px-3 py-2.5">
            <AlertCircle size={16} strokeWidth={1.9} className="flex-shrink-0 text-danger" />
            <p className="text-[12.5px] font-medium text-[#8A3F2C]">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={!valido || cargando}
          aria-busy={cargando}
          className={cn(
            "mt-1 flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-bold transition active:scale-[0.99]",
            valido ? "bg-gold-500 text-ink shadow-[0_2px_8px_rgba(201,162,94,0.32)]" : "cursor-not-allowed bg-neutral-100 text-muted",
          )}
        >
          {cargando ? "Activando…" : "Activar y entrar"}
        </button>
      </form>
    </div>
  );
}

/**
 * Paso final de la activación (spec "Bienvenida" de Activacion Cuenta.dc.html):
 * admin = sparkles dorado ("¡Todo listo!"), operativo = check verde. El botón
 * "Empezar" lleva a Inicio (la sesión ya quedó guardada al activar).
 */
function PantallaBienvenida({
  nombre,
  esAdmin,
  negocio,
  onEmpezar,
}: {
  nombre: string;
  esAdmin: boolean;
  negocio: string | null;
  onEmpezar: () => void;
}) {
  return (
    <div className="w-full text-center">
      {/* Halo de fondo a pantalla completa (dorado admin / verde operativo). */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed inset-0",
          esAdmin
            ? "bg-[radial-gradient(circle_at_50%_32%,rgba(201,162,94,0.14),transparent_58%)]"
            : "bg-[radial-gradient(circle_at_50%_32%,rgba(46,125,107,0.12),transparent_58%)]",
        )}
      />

      <div className="relative mx-auto mb-7 w-fit">
        <div
          aria-hidden
          className={cn(
            "absolute -inset-6 animate-glowpulse rounded-full",
            esAdmin
              ? "bg-[radial-gradient(circle,rgba(201,162,94,0.35),transparent_70%)]"
              : "bg-[radial-gradient(circle,rgba(46,125,107,0.28),transparent_70%)]",
          )}
        />
        <div
          className={cn(
            "relative flex h-[104px] w-[104px] items-center justify-center rounded-[28px] border",
            esAdmin
              ? "border-gold-tint-border bg-gold-tint shadow-[0_8px_26px_rgba(201,162,94,0.30)]"
              : "border-[#BFE0D5] bg-[#E2EFEB] shadow-[0_8px_26px_rgba(46,125,107,0.22)]",
          )}
        >
          {esAdmin ? (
            <Sparkles size={54} strokeWidth={1.5} className="text-gold-600" />
          ) : (
            <CheckCircle2 size={56} strokeWidth={1.6} className="text-success" />
          )}
        </div>
      </div>

      <h1 className="font-serif text-[28px] font-semibold tracking-[-0.02em] text-ink">
        {esAdmin ? "¡Todo listo, " : "¡Te damos la bienvenida, "}
        <span className="text-gold-500">{nombre}</span>!
      </h1>
      <p className="mx-auto mt-3 max-w-[290px] text-[14.5px] leading-relaxed text-body">
        {esAdmin ? (
          <>Tu negocio{negocio ? <> <span className="font-medium">{negocio}</span></> : null} está configurado. Ya puedes empezar a gestionar tus clientes.</>
        ) : (
          <>Ya puedes empezar a gestionar tus clientes.</>
        )}
      </p>

      <button
        type="button"
        onClick={onEmpezar}
        className="mt-9 flex h-12 w-full items-center justify-center rounded-xl bg-gold-500 text-[15px] font-bold text-ink shadow-[0_2px_8px_rgba(201,162,94,0.32)] transition active:scale-[0.99]"
      >
        Empezar
      </button>
    </div>
  );
}

function Mensaje({
  tono,
  titulo,
  texto,
  children,
}: {
  tono: "ok" | "error";
  titulo: string;
  texto: string;
  children?: React.ReactNode;
}) {
  const Icon = tono === "ok" ? CheckCircle2 : AlertCircle;
  return (
    <div className="w-full text-center">
      <div
        className={cn(
          "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full",
          tono === "ok" ? "bg-[#E4F0EC] text-teal-800" : "bg-[#F9ECE7] text-danger",
        )}
      >
        <Icon size={28} strokeWidth={1.8} />
      </div>
      <h1 className="font-serif text-[22px] font-semibold text-ink">{titulo}</h1>
      <p className="mx-auto mt-2 max-w-[300px] text-[13.5px] leading-relaxed text-muted">{texto}</p>
      {children}
    </div>
  );
}

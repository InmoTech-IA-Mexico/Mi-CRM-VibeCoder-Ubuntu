"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Lock, Eye, EyeOff, AlertCircle, Mail, Clock, Globe, Building2, CheckCircle2 } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { guardarToken } from "@/components/session/session-provider";
import { BarraFortaleza } from "@/components/ui/barra-fortaleza";
import { ZONAS_MX } from "@/lib/fechas";
import { cn } from "@/lib/utils";

// Activación de cuenta desde invitación (JUA-8 admin / JUA-9 operativo). El
// admin además configura su negocio (nombre + zona horaria). Al activar, entra
// directo al CRM (sin pasar por Login). Diseño: Activacion Cuenta.dc.html.

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
      router.replace("/inicio");
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

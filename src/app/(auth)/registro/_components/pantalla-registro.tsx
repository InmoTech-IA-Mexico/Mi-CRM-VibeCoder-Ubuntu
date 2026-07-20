"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { Building2, User, Mail, Lock, Eye, EyeOff, Globe, AlertCircle, CheckCircle2, MailCheck } from "lucide-react";
import { BarraFortaleza } from "@/components/ui/barra-fortaleza";
import { ZONAS_MX } from "@/lib/fechas";
import { cn } from "@/lib/utils";

// Formulario público de registro (JUA-39). Envía a la frontera `/api/registro` (que verifica
// Turnstile + origen Cloudflare y llama a Convex). Inerte sin `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
// (registro deshabilitado). Validación de formato en cliente para no gastar el token de
// Turnstile en errores triviales; el servidor revalida todo.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const inputBox = "flex h-12 items-center gap-2.5 rounded-xl border border-border-input px-3 transition focus-within:border-gold-500 focus-within:ring-[3px] focus-within:ring-gold-500/[0.18]";

export function PantallaRegistro() {
  const [nombreNegocio, setNombreNegocio] = useState("");
  const [nombreAdmin, setNombreAdmin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [zona, setZona] = useState<string>(ZONAS_MX[0].tz);
  const [ver, setVer] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const widget = useRef<TurnstileInstance>(null);

  if (!SITE_KEY) {
    return (
      <Mensaje
        tono="error"
        titulo="Registro no disponible"
        texto="El registro de nuevos negocios no está habilitado por el momento."
      >
        <Link href="/login" className="mt-5 text-[13.5px] font-medium text-teal-800 underline">
          Volver a iniciar sesión
        </Link>
      </Mensaje>
    );
  }

  if (enviado) {
    return (
      <div className="w-full text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#E4F0EC] text-teal-800">
          <MailCheck size={28} strokeWidth={1.8} />
        </div>
        <h1 className="font-serif text-[22px] font-semibold text-ink">Revisa tu correo</h1>
        <p className="mx-auto mt-2 max-w-[320px] text-[13.5px] leading-relaxed text-muted">
          Si el email es válido, te enviamos un enlace para confirmar tu registro y activar tu cuenta. El
          enlace caduca en 24 horas.
        </p>
        <Link href="/login" className="mt-6 inline-block text-[13.5px] font-medium text-teal-800 underline">
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  const coincide = password.length > 0 && password === confirmar;
  const valido =
    nombreNegocio.trim().length > 0 &&
    nombreAdmin.trim().length > 0 &&
    EMAIL_RE.test(email.trim()) &&
    password.length >= 8 &&
    coincide &&
    !!zona &&
    !!turnstileToken;

  const enviar = async () => {
    if (cargando) return;
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (!coincide) return setError("Las contraseñas no coinciden.");
    if (!turnstileToken) return setError("Completa la verificación de seguridad.");
    setError(null);
    setCargando(true);
    try {
      const r = await fetch("/api/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turnstileToken,
          nombreNegocio: nombreNegocio.trim(),
          nombreAdmin: nombreAdmin.trim(),
          email: email.trim().toLowerCase(),
          password,
          zonaHoraria: zona,
        }),
      });
      const data = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (r.ok && data.ok) {
        setEnviado(true);
        return;
      }
      if (r.status === 429) setError("Hay demasiadas solicitudes en este momento. Inténtalo en un minuto.");
      else if (r.status === 503) setError("El registro no está disponible por el momento.");
      else if (r.status === 403) setError("No se pudo verificar la seguridad. Vuelve a intentarlo.");
      else setError(typeof data.error === "string" ? data.error : "No se pudo completar el registro. Inténtalo de nuevo.");
    } catch {
      setError("No se pudo conectar. Inténtalo de nuevo.");
    }
    // El token de Turnstile es de un solo uso: se reinicia para el próximo intento.
    setTurnstileToken("");
    widget.current?.reset();
    setCargando(false);
  };

  return (
    <div className="w-full">
      <header className="mb-6 text-center">
        <h1 className="font-serif text-[26px] font-semibold text-ink">Crea tu cuenta</h1>
        <p className="mt-1.5 text-[13.5px] text-muted">Registra tu negocio en InmoTech IA y empieza a gestionar tus clientes.</p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
        className="flex flex-col gap-4"
      >
        <Campo etiqueta="Nombre del negocio" icono={<Building2 size={18} strokeWidth={1.6} className="text-neutral-400" />}>
          <input value={nombreNegocio} onChange={(e) => setNombreNegocio(e.target.value)} maxLength={80} placeholder="Tu inmobiliaria" aria-label="Nombre del negocio" className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted" />
        </Campo>

        <Campo etiqueta="Tu nombre" icono={<User size={18} strokeWidth={1.6} className="text-neutral-400" />}>
          <input value={nombreAdmin} onChange={(e) => setNombreAdmin(e.target.value)} maxLength={80} placeholder="Nombre y apellido" aria-label="Tu nombre" className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted" />
        </Campo>

        <Campo etiqueta="Email" icono={<Mail size={18} strokeWidth={1.6} className="text-neutral-400" />}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoCapitalize="none" placeholder="tucorreo@dominio.mx" aria-label="Email" className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted" />
        </Campo>

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-ink">Contraseña</label>
          <div className={inputBox}>
            <Lock size={18} strokeWidth={1.6} className="text-neutral-400" />
            <input type={ver ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} maxLength={128} placeholder="Mínimo 8 caracteres" autoCapitalize="none" aria-label="Contraseña" className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted" />
            <button type="button" aria-label={ver ? "Ocultar" : "Mostrar"} onClick={() => setVer((v) => !v)} className="text-neutral-400">
              {ver ? <EyeOff size={18} strokeWidth={1.7} /> : <Eye size={18} strokeWidth={1.7} />}
            </button>
          </div>
          <BarraFortaleza password={password} />
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-ink">Confirmar contraseña</label>
          <div className={inputBox}>
            <Lock size={18} strokeWidth={1.6} className="text-neutral-400" />
            <input type={ver ? "text" : "password"} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} maxLength={128} placeholder="Repite la contraseña" autoCapitalize="none" aria-label="Confirmar contraseña" className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted" />
          </div>
          {confirmar.length > 0 && !coincide && <p className="mt-1.5 text-[11.5px] font-medium text-danger">Las contraseñas no coinciden.</p>}
        </div>

        <Campo etiqueta="Zona horaria" icono={<Globe size={18} strokeWidth={1.6} className="text-neutral-400" />}>
          <select value={zona} onChange={(e) => setZona(e.target.value)} aria-label="Zona horaria del negocio" className="w-full bg-transparent text-[14.5px] text-ink outline-none">
            {ZONAS_MX.map((z) => (
              <option key={z.tz} value={z.tz}>
                {z.label}
              </option>
            ))}
          </select>
        </Campo>

        <div className="flex justify-center pt-1">
          <Turnstile ref={widget} siteKey={SITE_KEY} options={{ action: "registro_negocio", theme: "light" }} onSuccess={setTurnstileToken} onError={() => setTurnstileToken("")} onExpire={() => setTurnstileToken("")} />
        </div>

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
          {cargando ? "Enviando…" : "Crear cuenta"}
        </button>

        <p className="text-center text-[13px] text-muted">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-teal-800 underline">
            Inicia sesión
          </Link>
        </p>
      </form>
    </div>
  );
}

function Campo({ etiqueta, icono, children }: { etiqueta: string; icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-ink">{etiqueta}</label>
      <div className={inputBox}>
        {icono}
        {children}
      </div>
    </div>
  );
}

function Mensaje({ tono, titulo, texto, children }: { tono: "ok" | "error"; titulo: string; texto: string; children?: React.ReactNode }) {
  const Icon = tono === "ok" ? CheckCircle2 : AlertCircle;
  return (
    <div className="w-full text-center">
      <div className={cn("mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full", tono === "ok" ? "bg-[#E4F0EC] text-teal-800" : "bg-[#F9ECE7] text-danger")}>
        <Icon size={28} strokeWidth={1.8} />
      </div>
      <h1 className="font-serif text-[22px] font-semibold text-ink">{titulo}</h1>
      <p className="mx-auto mt-2 max-w-[300px] text-[13.5px] leading-relaxed text-muted">{texto}</p>
      {children}
    </div>
  );
}

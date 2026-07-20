"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation } from "convex/react";
import { AlertCircle, CheckCircle2, Clock, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { guardarToken } from "@/components/session/session-provider";
import { BotonGoogle, googleConfigurado } from "@/components/auth/boton-google";
import { cn } from "@/lib/utils";

// Login con autenticación real (JUA-6). Estados: normal · error genérico ·
// cargando · bloqueado (5 intentos → 30 min). Diseño: Login.dc.html.
export function FormularioLogin({
  expirada = false,
  restablecida = false,
}: {
  expirada?: boolean;
  restablecida?: boolean;
}) {
  const router = useRouter();
  const iniciarSesion = useMutation(api.auth.iniciarSesion);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [bloqueadoHasta, setBloqueadoHasta] = useState<number | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());

  // Cuenta atrás mientras la cuenta está bloqueada.
  useEffect(() => {
    if (bloqueadoHasta === null) return;
    const id = setInterval(() => {
      const t = Date.now();
      setAhora(t);
      if (t >= bloqueadoHasta) setBloqueadoHasta(null);
    }, 1000);
    return () => clearInterval(id);
  }, [bloqueadoHasta]);

  const bloqueado = bloqueadoHasta !== null;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (cargando || bloqueado) return;
    if (!email.trim() || !password) {
      setError("Email o contraseña incorrectos");
      return;
    }
    setError(null);
    setCargando(true);
    try {
      const res = await iniciarSesion({ email: email.trim(), password });
      if (res.ok) {
        guardarToken(res.token);
        router.push("/inicio");
        return; // dejar "Verificando…" mientras navega
      }
      setCargando(false);
      if (res.bloqueadoHasta) {
        setAhora(Date.now());
        setBloqueadoHasta(res.bloqueadoHasta);
      } else {
        setError("Email o contraseña incorrectos");
      }
    } catch {
      setCargando(false);
      setError("No se pudo conectar. Inténtalo de nuevo.");
    }
  };

  const limpiarError = () => error && setError(null);
  const hayError = error !== null;
  const inactivo = cargando || bloqueado;
  const claseCampo = cn(
    "flex h-12 items-center gap-2.5 rounded-input border px-3 transition",
    hayError ? "border-danger ring-[3px] ring-danger/15" : "border-border-input",
  );

  const restanteMs = bloqueadoHasta ? Math.max(0, bloqueadoHasta - ahora) : 0;
  const mm = String(Math.floor(restanteMs / 60000)).padStart(2, "0");
  const ss = String(Math.floor((restanteMs % 60000) / 1000)).padStart(2, "0");

  return (
    <>
      {/* Resplandor dorado de fondo (Login.dc.html) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_50%_34%,rgba(201,162,94,0.12),transparent_58%)]"
      />

      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="font-serif text-3xl font-bold tracking-tight text-ink">
          InmoTech <span className="text-gold-500">IA</span>
        </div>
        <p className="mt-1.5 text-[13px] text-muted">Gestión de clientes</p>
      </div>

      {/* Tarjeta */}
      <form
        onSubmit={enviar}
        noValidate
        className="w-full rounded-modal border border-neutral-100 bg-surface p-6 shadow-[0_16px_36px_rgba(14,46,52,0.10)]"
      >
        <h1 className="mb-5 font-serif text-[22px] font-semibold text-ink">Iniciar sesión</h1>

        {restablecida && !bloqueado && !hayError && (
          <div className="mb-4 flex items-center gap-2 rounded-input border border-teal-800/20 bg-[#E4F0EC] px-3 py-2.5">
            <CheckCircle2 size={16} strokeWidth={1.9} className="text-teal-800" />
            <span className="text-[12.5px] font-medium text-teal-800">Contraseña actualizada. Ya puedes iniciar sesión.</span>
          </div>
        )}

        {expirada && !restablecida && !bloqueado && !hayError && (
          <div className="mb-4 flex items-center gap-2 rounded-input bg-neutral-50 px-3 py-2.5">
            <Clock size={16} strokeWidth={1.8} className="text-muted" />
            <span className="text-[12.5px] text-body">Tu sesión ha expirado, inicia sesión de nuevo.</span>
          </div>
        )}

        {/* Estado bloqueado (Login.dc.html Estado 4) */}
        {bloqueado && (
          <div className="mb-5 rounded-[14px] border border-danger/25 bg-[#F6E7E0] p-[18px] text-center">
            <div className="flex items-center justify-center gap-2">
              <Lock size={20} strokeWidth={1.8} className="text-danger" />
              <span className="text-[16px] font-bold text-[#8A3F2C]">Cuenta bloqueada</span>
            </div>
            <div className="mt-3 flex items-center justify-center gap-1.5">
              <Clock size={16} strokeWidth={1.8} className="text-danger" />
              <span className="text-[12.5px] text-[#8A3F2C]">Intenta de nuevo en</span>
            </div>
            <div className="mt-1.5 font-serif text-[38px] font-semibold tabular-nums text-danger">
              {mm}:{ss}
            </div>
          </div>
        )}

        {/* Campos: atenuados/deshabilitados mientras se verifica o está bloqueado. */}
        <fieldset disabled={inactivo} className={cn("m-0 border-0 p-0", inactivo && "opacity-55")}>
          <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-ink">
            Email
          </label>
          <div className={claseCampo}>
            <Mail size={18} strokeWidth={1.6} className={hayError ? "text-danger" : "text-neutral-400"} />
            <input
              id="email"
              suppressHydrationWarning
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                limpiarError();
              }}
              placeholder="nombre@empresa.mx"
              className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
            />
          </div>

          <label htmlFor="password" className="mb-1.5 mt-4 block text-[13px] font-medium text-ink">
            Contraseña
          </label>
          <div className={claseCampo}>
            <Lock size={18} strokeWidth={1.6} className={hayError ? "text-danger" : "text-neutral-400"} />
            <input
              id="password"
              suppressHydrationWarning
              type={verPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                limpiarError();
              }}
              placeholder="••••••••"
              className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
            />
            <button
              type="button"
              onClick={() => setVerPassword((v) => !v)}
              aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="text-neutral-400"
            >
              {verPassword ? <EyeOff size={18} strokeWidth={1.6} /> : <Eye size={18} strokeWidth={1.6} />}
            </button>
          </div>
        </fieldset>

        {hayError && (
          <div className="mt-3.5 flex items-center gap-2">
            <AlertCircle size={16} strokeWidth={1.8} className="text-danger" />
            <span className="text-[13px] font-medium text-[#8A3F2C]">{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={inactivo}
          className={cn(
            "mt-[22px] flex h-12 w-full items-center justify-center gap-2.5 rounded-[24px] text-[16px] font-semibold transition",
            bloqueado
              ? "cursor-not-allowed border border-neutral-100 bg-neutral-50 text-muted"
              : "bg-gold-500 text-ink shadow-[0_4px_14px_rgba(201,162,94,0.35)] active:scale-[0.99] disabled:cursor-wait",
          )}
        >
          {cargando ? (
            <>
              <span className="h-[18px] w-[18px] animate-spin rounded-full border-[2.5px] border-ink/25 border-t-ink" />
              Verificando…
            </>
          ) : (
            "Entrar"
          )}
        </button>

        <div className={cn("mt-4 text-center", inactivo && "pointer-events-none opacity-55")}>
          <Link href="/recuperar-password" className="text-[13px] font-semibold text-gold-text">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        {/* Login con Google (JUA-40): solo si hay Client ID. Independiente del bloqueo por
            intentos de contraseña (es otra credencial, no una adivinación de contraseña). */}
        {googleConfigurado && (
          <div>
            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-neutral-100" />
              <span className="text-[12px] text-muted">o</span>
              <span className="h-px flex-1 bg-neutral-100" />
            </div>
            <BotonGoogle
              modo="login"
              onOk={(token) => {
                guardarToken(token);
                router.push("/inicio");
              }}
              onError={(m) => setError(m)}
            />
          </div>
        )}
      </form>
      {/* Registro público (JUA-39): visible solo si está habilitado (hay site key de Turnstile). */}
      {!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
        <p className="mt-5 text-center text-[13px] text-muted">
          ¿Nuevo negocio?{" "}
          <Link href="/registro" className="font-semibold text-gold-text">
            Crea tu cuenta
          </Link>
        </p>
      )}
    </>
  );
}

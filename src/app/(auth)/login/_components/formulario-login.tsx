"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

// Login fiel a Login.dc.html (estados: normal · error · cargando).
// TODO(JUA-6/JUA-30): autenticación real. Hoy cualquier email + contraseña no
// vacíos entran a la sesión simulada.
export function FormularioLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (cargando) return;
    if (!email.trim() || !password) {
      setError("Email o contraseña incorrectos");
      return;
    }
    setError(null);
    setCargando(true);
    // Pequeño retardo para mostrar el estado "Verificando…" antes de entrar.
    setTimeout(() => router.push("/inicio"), 700);
  };

  const limpiarError = () => error && setError(null);
  const hayError = error !== null;
  const claseCampo = cn(
    "flex h-12 items-center gap-2.5 rounded-input border px-3 transition",
    hayError ? "border-danger ring-[3px] ring-danger/15" : "border-border-input",
  );

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

        {/* Campos: se atenúan y deshabilitan mientras se verifica (Login.dc.html). */}
        <fieldset
          disabled={cargando}
          className={cn("m-0 border-0 p-0", cargando && "opacity-55")}
        >
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
          disabled={cargando}
          className="mt-[22px] flex h-12 w-full items-center justify-center gap-2.5 rounded-[24px] bg-gold-500 text-[16px] font-semibold text-ink shadow-[0_4px_14px_rgba(201,162,94,0.35)] transition active:scale-[0.99] disabled:cursor-wait"
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

        <div className={cn("mt-4 text-center", cargando && "pointer-events-none opacity-55")}>
          <Link href="/recuperar-password" className="text-[13px] font-semibold text-gold-text">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </form>
    </>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { Mail, AlertCircle, ArrowLeft, MailCheck } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { cn } from "@/lib/utils";

// Recuperar contraseña (JUA-7). Mensaje de confirmación genérico (no revela si
// el email existe). El envío real del enlace por email queda pendiente (Resend).
export function PantallaRecuperar() {
  const solicitar = useMutation(api.recuperacion.solicitar);
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (cargando) return;
    if (!emailOk) {
      setError("Escribe un email válido");
      return;
    }
    setError(null);
    setCargando(true);
    try {
      await solicitar({ email: email.trim() });
      setEnviado(true);
    } catch (err) {
      console.error("No se pudo solicitar la recuperación", err);
      setError("No se pudo enviar el enlace. Inténtalo de nuevo.");
      setCargando(false);
    }
  };

  if (enviado) {
    return (
      <div className="w-full text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#E4F0EC] text-teal-800">
          <MailCheck size={28} strokeWidth={1.8} />
        </div>
        <h1 className="font-serif text-[22px] font-semibold text-ink">Revisa tu correo</h1>
        <p className="mx-auto mt-2 max-w-[300px] text-[13.5px] leading-relaxed text-muted">
          Si <span className="font-medium text-body">{email.trim()}</span> está registrado, te enviamos un
          enlace para restablecer tu contraseña. Es válido 24 horas.
        </p>
        <Link href="/login" className="mt-6 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-teal-800">
          <ArrowLeft size={15} strokeWidth={2} />
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <header className="mb-6 text-center">
        <h1 className="font-serif text-[26px] font-semibold text-ink">Recuperar acceso</h1>
        <p className="mt-1.5 text-[13.5px] text-muted">
          Escribe tu email y te enviaremos un enlace para restablecer tu contraseña.
        </p>
      </header>

      <form onSubmit={enviar} className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-ink">Email</label>
          <div
            className={cn(
              "flex h-12 items-center gap-2.5 rounded-xl border px-3 transition",
              error ? "border-danger ring-[3px] ring-danger/15" : "border-border-input focus-within:border-gold-500 focus-within:ring-[3px] focus-within:ring-gold-500/[0.18]",
            )}
          >
            <Mail size={18} strokeWidth={1.6} className={error ? "text-danger" : "text-neutral-400"} />
            <input
              autoFocus
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder="nombre@empresa.mx"
              inputMode="email"
              autoCapitalize="none"
              aria-label="Email"
              className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
            />
          </div>
          {error && (
            <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-danger">
              <AlertCircle size={14} strokeWidth={1.9} />
              {error}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={cargando}
          aria-busy={cargando}
          className="mt-1 flex h-12 w-full items-center justify-center rounded-xl bg-gold-500 text-[15px] font-bold text-ink shadow-[0_2px_8px_rgba(201,162,94,0.32)] transition active:scale-[0.99] disabled:opacity-70"
        >
          {cargando ? "Enviando…" : "Enviar enlace de acceso"}
        </button>

        <Link href="/login" className="mt-1 inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold text-teal-800">
          <ArrowLeft size={15} strokeWidth={2} />
          Volver a iniciar sesión
        </Link>
      </form>
    </div>
  );
}

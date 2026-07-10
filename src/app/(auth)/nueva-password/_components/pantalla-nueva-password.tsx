"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { Lock, Eye, EyeOff, AlertCircle, Mail } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { BarraFortaleza } from "@/components/ui/barra-fortaleza";
import { cn } from "@/lib/utils";

// Nueva contraseña desde el enlace de recuperación (JUA-7). Un solo uso; al
// guardar redirige al Login con mensaje de éxito. Estados de enlace
// inválido/usado/expirado con opción de solicitar uno nuevo. Token vía prop del
// server (SSR-safe, sin mismatch de hidratación).
export function PantallaNuevaPassword({ token }: { token: string }) {
  const info = useQuery(api.recuperacion.porToken, token ? { token } : "skip");
  const restablecer = useMutation(api.recuperacion.restablecer);

  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [ver, setVer] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) return <Mensaje titulo="Enlace no válido" texto="Falta el código de recuperación en el enlace." />;
  if (info === undefined) return <p className="text-center text-[14px] text-muted">Cargando…</p>;
  if (info.estado === "invalida")
    return <Mensaje titulo="Enlace no válido" texto="Este enlace de recuperación no existe." />;
  if (info.estado === "usada")
    return <Mensaje titulo="Enlace ya utilizado" texto="Este enlace ya se usó para cambiar la contraseña. Solicita uno nuevo si lo necesitas." />;
  if (info.estado === "expirada")
    return <Mensaje titulo="Este enlace ha expirado" texto="Los enlaces de recuperación son válidos 24 horas. Solicita uno nuevo." />;

  const pwdOk = password.length >= 8;
  const coincide = password.length > 0 && password === confirmar;
  const valido = pwdOk && coincide;

  const guardar = async () => {
    if (cargando) return;
    if (!pwdOk) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (!coincide) return setError("Las contraseñas no coinciden.");
    setError(null);
    setCargando(true);
    try {
      await restablecer({ token, password });
      // Recarga limpia al login para mostrar el mensaje de éxito (?reset=1).
      window.location.href = "/login?reset=1";
    } catch (e) {
      const msg = e instanceof Error ? e.message.replace(/^\[.*?\]\s*/, "") : "";
      console.error("No se pudo restablecer la contraseña", e);
      setError(msg && !/Uncaught|Server Error/.test(msg) ? msg : "No se pudo guardar la contraseña. Inténtalo de nuevo.");
      setCargando(false);
    }
  };

  return (
    <div className="w-full">
      <header className="mb-6 text-center">
        <h1 className="font-serif text-[26px] font-semibold text-ink">Nueva contraseña</h1>
        <p className="mt-1.5 text-[13.5px] text-muted">Crea una contraseña nueva para tu cuenta.</p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
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

        {/* Nueva contraseña */}
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
          {cargando ? "Guardando…" : "Guardar contraseña"}
        </button>
      </form>
    </div>
  );
}

function Mensaje({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="w-full text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F9ECE7] text-danger">
        <AlertCircle size={28} strokeWidth={1.8} />
      </div>
      <h1 className="font-serif text-[22px] font-semibold text-ink">{titulo}</h1>
      <p className="mx-auto mt-2 max-w-[300px] text-[13.5px] leading-relaxed text-muted">{texto}</p>
      <Link href="/recuperar-password" className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-gold-500 text-[15px] font-bold text-ink shadow-[0_2px_8px_rgba(201,162,94,0.32)] active:scale-[0.99]">
        Solicitar un enlace nuevo
      </Link>
      <Link href="/login" className="mt-3 inline-block text-[13px] font-semibold text-teal-800">
        Volver a iniciar sesión
      </Link>
    </div>
  );
}

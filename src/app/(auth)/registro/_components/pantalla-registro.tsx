"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { Building2, User, Mail, Lock, Globe, Eye, EyeOff, AlertCircle } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { guardarToken } from "@/components/session/session-provider";
import { BarraFortaleza } from "@/components/ui/barra-fortaleza";
import { ZONAS_MX } from "@/lib/fechas";
import { cn } from "@/lib/utils";

// Registro público autoservicio (JUA-39). El negocio se da de alta solo: nombre
// del negocio, nombre de la persona, email, contraseña (×2) y zona horaria. Al
// enviar se crea el negocio + el admin y se entra directo al CRM (sin invitación).
// La verificación de email queda pendiente del envío por Resend.

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const claseCampo =
  "flex h-12 items-center gap-2.5 rounded-xl border border-border-input px-3 transition focus-within:border-gold-500 focus-within:ring-[3px] focus-within:ring-gold-500/[0.18]";

export function PantallaRegistro() {
  const router = useRouter();
  const registrar = useMutation(api.registro.registrarNegocio);

  const [nombreNegocio, setNombreNegocio] = useState("");
  const [nombreAdmin, setNombreAdmin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [zona, setZona] = useState<string>(ZONAS_MX[0].tz);
  const [ver, setVer] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailOk = EMAIL_RE.test(email.trim());
  const pwdOk = password.length >= 8;
  const coincide = password.length > 0 && password === confirmar;
  const valido = !!nombreNegocio.trim() && !!nombreAdmin.trim() && emailOk && pwdOk && coincide && !!zona;

  const enviar = async () => {
    if (cargando) return;
    if (!emailOk) return setError("Escribe un email válido.");
    if (!pwdOk) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (!coincide) return setError("Las contraseñas no coinciden.");
    setError(null);
    setCargando(true);
    try {
      const res = await registrar({
        nombreNegocio: nombreNegocio.trim(),
        nombreAdmin: nombreAdmin.trim(),
        email: email.trim(),
        password,
        zonaHoraria: zona,
      });
      guardarToken(res.token);
      router.replace("/inicio");
    } catch (e) {
      const msg = e instanceof Error ? e.message.replace(/^\[.*?\]\s*/, "") : "";
      console.error("No se pudo crear la cuenta", e);
      setError(msg && !/Uncaught|Server Error/.test(msg) ? msg : "No se pudo crear la cuenta. Inténtalo de nuevo.");
      setCargando(false);
    }
  };

  return (
    <div className="w-full">
      <header className="mb-6 text-center">
        <h1 className="font-serif text-[26px] font-semibold text-ink">Crea tu cuenta</h1>
        <p className="mt-1.5 text-[13.5px] text-muted">Da de alta tu negocio y empieza a gestionar tus clientes.</p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
        className="flex flex-col gap-4"
      >
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-ink">Nombre del negocio</label>
          <div className={claseCampo}>
            <Building2 size={18} strokeWidth={1.6} className="text-neutral-400" />
            <input
              value={nombreNegocio}
              onChange={(e) => setNombreNegocio(e.target.value)}
              placeholder="Nombre de tu inmobiliaria"
              aria-label="Nombre del negocio"
              maxLength={80}
              className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-ink">Tu nombre</label>
          <div className={claseCampo}>
            <User size={18} strokeWidth={1.6} className="text-neutral-400" />
            <input
              value={nombreAdmin}
              onChange={(e) => setNombreAdmin(e.target.value)}
              placeholder="Nombre y apellido"
              aria-label="Tu nombre"
              maxLength={80}
              className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-ink">Email</label>
          <div className={claseCampo}>
            <Mail size={18} strokeWidth={1.6} className="text-neutral-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.mx"
              autoCapitalize="none"
              aria-label="Email"
              className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-ink">Contraseña</label>
          <div className={claseCampo}>
            <Lock size={18} strokeWidth={1.6} className="text-neutral-400" />
            <input
              type={ver ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              autoCapitalize="none"
              aria-label="Contraseña"
              className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
            />
            <button type="button" aria-label={ver ? "Ocultar" : "Mostrar"} onClick={() => setVer((v) => !v)} className="text-neutral-400">
              {ver ? <EyeOff size={18} strokeWidth={1.7} /> : <Eye size={18} strokeWidth={1.7} />}
            </button>
          </div>
          <BarraFortaleza password={password} />
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-ink">Confirmar contraseña</label>
          <div className={claseCampo}>
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

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-ink">
            Zona horaria <span className="text-danger">*</span>
          </label>
          <div className={claseCampo}>
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
          <p className="mt-1.5 text-[11.5px] leading-snug text-muted">
            Todas las fechas del CRM (agenda, recordatorios, inactividad) se calculan con esta zona.
          </p>
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
          {cargando ? "Creando tu cuenta…" : "Crear cuenta y entrar"}
        </button>

        <div className="mt-1 text-center">
          <Link href="/login" className="text-[13px] font-medium text-body">
            ¿Ya tienes cuenta? <span className="font-semibold text-gold-text">Inicia sesión</span>
          </Link>
        </div>
      </form>
    </div>
  );
}

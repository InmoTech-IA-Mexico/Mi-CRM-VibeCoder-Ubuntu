"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Building2, Mail, AlertCircle } from "lucide-react";
import { api } from "../../../../../../convex/_generated/api";
import { guardarToken } from "@/components/session/session-provider";
import { cn } from "@/lib/utils";

// Confirmación del registro (JUA-39). Muestra el negocio/email (al portador del token) y crea
// la cuenta con una ACCIÓN del usuario (no en el montaje) para no consumir el token por
// prefetch del cliente de correo. Al montar, limpia el token de la URL (control 5): fuera de
// historial y del referrer. Al confirmar, guarda la sesión y entra al CRM.

export function PantallaConfirmarRegistro({ token }: { token: string }) {
  const router = useRouter();

  useEffect(() => {
    if (token && typeof window !== "undefined") {
      try {
        window.history.replaceState(null, "", "/registro/confirmar");
      } catch {
        // Si no se puede reescribir, el token solo permanece en la barra de esta pestaña.
      }
    }
  }, [token]);

  const info = useQuery(api.registro.porToken, token ? { token } : "skip");
  const confirmar = useMutation(api.registro.confirmar);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) return <Mensaje titulo="Enlace no válido" texto="Falta el código de confirmación en el enlace." />;
  if (info === undefined) return <p className="text-center text-[14px] text-muted">Cargando…</p>;
  if (info.estado === "invalido") return <Mensaje titulo="Enlace no válido" texto="Este enlace no existe o ya se usó." />;
  if (info.estado === "expirado")
    return (
      <Mensaje titulo="El enlace expiró" texto="Este enlace de confirmación ya no es válido.">
        <Link href="/registro" className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-gold-500 text-[15px] font-bold text-ink shadow-[0_2px_8px_rgba(201,162,94,0.32)] active:scale-[0.99]">
          Volver a registrarme
        </Link>
      </Mensaje>
    );

  const crear = async () => {
    if (cargando) return;
    setError(null);
    setCargando(true);
    try {
      const res = await confirmar({ token });
      guardarToken(res.token);
      router.replace("/inicio");
    } catch (e) {
      const msg = e instanceof Error ? e.message.replace(/^\[.*?\]\s*/, "") : "";
      // Sin volcar el error crudo a la consola (obs.): evita imprimir detalles inesperados.
      setError(msg && !/Uncaught|Server Error/.test(msg) ? msg : "No se pudo confirmar el registro. Inténtalo de nuevo.");
      setCargando(false);
    }
  };

  return (
    <div className="w-full text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] border border-gold-tint-border bg-gold-tint text-gold-600 shadow-[0_6px_20px_rgba(201,162,94,0.24)]">
        <Building2 size={34} strokeWidth={1.5} />
      </div>
      <h1 className="font-serif text-[24px] font-semibold text-ink">Confirma tu registro</h1>
      <p className="mx-auto mt-2 max-w-[320px] text-[14px] leading-relaxed text-body">
        Vas a crear la cuenta de <span className="font-semibold text-ink">{info.negocioNombre}</span> y entrarás como administrador.
      </p>
      <div className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-xl border border-border-input bg-neutral-50 px-3 py-2">
        <Mail size={16} strokeWidth={1.7} className="text-neutral-400" />
        <span className="text-[13.5px] text-body">{info.email}</span>
      </div>

      {error && (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-danger/30 bg-[#F9ECE7] px-3 py-2.5 text-left">
          <AlertCircle size={16} strokeWidth={1.9} className="flex-shrink-0 text-danger" />
          <p className="text-[12.5px] font-medium text-[#8A3F2C]">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => void crear()}
        disabled={cargando}
        aria-busy={cargando}
        className={cn(
          "mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-gold-500 text-[15px] font-bold text-ink shadow-[0_2px_8px_rgba(201,162,94,0.32)] transition active:scale-[0.99]",
          cargando && "opacity-70",
        )}
      >
        {cargando ? "Creando…" : "Crear mi cuenta y entrar"}
      </button>
    </div>
  );
}

function Mensaje({ titulo, texto, children }: { titulo: string; texto: string; children?: React.ReactNode }) {
  return (
    <div className="w-full text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F9ECE7] text-danger">
        <AlertCircle size={28} strokeWidth={1.8} />
      </div>
      <h1 className="font-serif text-[22px] font-semibold text-ink">{titulo}</h1>
      <p className="mx-auto mt-2 max-w-[300px] text-[13.5px] leading-relaxed text-muted">{texto}</p>
      {children ?? (
        <Link href="/login" className="mt-5 inline-block text-[13.5px] font-medium text-teal-800 underline">
          Volver a iniciar sesión
        </Link>
      )}
    </div>
  );
}

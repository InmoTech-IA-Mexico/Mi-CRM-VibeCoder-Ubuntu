"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { X, User, Phone, Mail, AlertCircle, ChevronRight } from "lucide-react";
import { api } from "../../../../../../convex/_generated/api";
import { useSesion } from "@/components/session/use-sesion";
import { cn } from "@/lib/utils";

export function PantallaNuevoCliente() {
  const router = useRouter();
  const { token } = useSesion();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const crear = useMutation(api.clientes.crear);

  const nombreOk = nombre.trim().length > 0;
  const contactoOk = telefono.trim().length > 0 || email.trim().length > 0;
  const valido = nombreOk && contactoOk;

  // Aviso de duplicados (reactivo): busca por teléfono/email mientras se escribe.
  const duplicado = useQuery(
    api.clientes.buscarDuplicado,
    contactoOk ? { token, telefono, email } : "skip",
  );

  const guardar = async () => {
    if (guardando) return;
    if (!valido) {
      setIntentado(true);
      return;
    }
    setGuardando(true);
    try {
      const id = await crear({ token, nombre, telefono, email });
      router.replace(`/clientes/${id}`);
    } catch (error) {
      console.error("No se pudo crear el cliente", error);
      setGuardando(false);
    }
  };

  const mostrarErrorNombre = intentado && !nombreOk;
  const mostrarErrorContacto = intentado && nombreOk && !contactoOk;

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <header className="relative flex h-14 items-center justify-center px-3.5">
        <button
          type="button"
          aria-label="Cerrar"
          onClick={() => router.push("/clientes")}
          className="absolute left-3.5 flex h-11 w-11 items-center justify-center rounded-xl border border-border-input bg-surface shadow-sm active:scale-95"
        >
          <X size={20} strokeWidth={2} className="text-ink" />
        </button>
        <h1 className="font-serif text-xl font-semibold text-ink">Nuevo cliente</h1>
        <button
          type="button"
          onClick={guardar}
          disabled={!valido || guardando}
          aria-busy={guardando}
          className={cn(
            "absolute right-3.5 rounded-full px-4 py-2 text-[14px] font-semibold transition",
            valido
              ? "bg-gold-500 text-ink shadow-[0_2px_6px_rgba(201,162,94,0.32)] active:scale-95"
              : "cursor-not-allowed bg-neutral-100 text-muted",
          )}
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </header>

      <div className="flex flex-col gap-5 px-4 pt-2 pb-10">
        {/* Datos básicos */}
        <section>
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gold-text">
            Datos básicos
          </p>
          <div className="overflow-hidden rounded-[18px] border border-neutral-100 bg-surface shadow-sm">
            <div className="p-4">
              <Etiqueta obligatorio>Nombre completo</Etiqueta>
              <div
                className={cn(
                  "flex h-12 items-center gap-2.5 rounded-xl border px-3 transition",
                  mostrarErrorNombre
                    ? "border-danger ring-[3px] ring-danger/15"
                    : "border-border-input focus-within:border-gold-500 focus-within:ring-[3px] focus-within:ring-gold-500/[0.18]",
                )}
              >
                <User size={18} strokeWidth={1.6} className={mostrarErrorNombre ? "text-danger" : "text-neutral-400"} />
                <input
                  autoFocus
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="María García"
                  aria-label="Nombre completo"
                  className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
                />
              </div>
              {mostrarErrorNombre && (
                <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-danger">
                  <AlertCircle size={14} strokeWidth={1.9} />
                  El nombre es obligatorio
                </p>
              )}
            </div>

            <div className="mx-4 h-px bg-neutral-100" />

            <div className="p-4">
              <Etiqueta>Teléfono</Etiqueta>
              <div className="flex gap-2">
                <div className="flex h-12 items-center gap-1.5 rounded-xl border border-border-input bg-neutral-50 px-3">
                  <span className="text-[15px] font-semibold text-ink">+52</span>
                </div>
                <div className="flex h-12 flex-1 items-center gap-2.5 rounded-xl border border-border-input px-3 transition focus-within:border-gold-500 focus-within:ring-[3px] focus-within:ring-gold-500/[0.18]">
                  <Phone size={18} strokeWidth={1.6} className="text-neutral-400" />
                  <input
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="55 1234 5678"
                    inputMode="tel"
                    aria-label="Teléfono"
                    className="w-full bg-transparent text-[15px] tabular-nums text-ink outline-none placeholder:text-muted"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Información adicional */}
        <section>
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gold-text">
            Información adicional
          </p>
          <div className="overflow-hidden rounded-[18px] border border-neutral-100 bg-surface shadow-sm">
            <div className="p-4">
              <Etiqueta opcional>Email</Etiqueta>
              <div className="flex h-12 items-center gap-2.5 rounded-xl border border-border-input px-3 transition focus-within:border-gold-500 focus-within:ring-[3px] focus-within:ring-gold-500/[0.18]">
                <Mail size={18} strokeWidth={1.6} className="text-neutral-400" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="maria@empresa.mx"
                  inputMode="email"
                  autoCapitalize="none"
                  aria-label="Email"
                  className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Regla: nombre + al menos uno */}
        {mostrarErrorContacto && (
          <p className="-mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-danger">
            <AlertCircle size={14} strokeWidth={1.9} />
            Indica al menos un teléfono o un email
          </p>
        )}

        {/* Aviso de duplicado (avisa, no bloquea) */}
        {duplicado && (
          <Link
            href={`/clientes/${duplicado._id}`}
            className="flex items-center gap-3 rounded-2xl border border-[#E0C795] bg-[#F9F1DF] p-3.5 active:scale-[0.99]"
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#F4E4C1]">
              <AlertCircle size={18} strokeWidth={1.9} className="text-[#9A7327]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[#8A6420]">
                Ya existe un contacto con este {duplicado.campo === "telefono" ? "teléfono" : "email"}
              </p>
              <p className="mt-0.5 truncate text-[12.5px] text-[#9A7327]">
                {duplicado.nombre} — toca para ver su ficha
              </p>
            </div>
            <ChevronRight size={18} strokeWidth={1.8} className="flex-shrink-0 text-[#B99A5A]" />
          </Link>
        )}

        <p className="px-1 text-[12px] leading-snug text-muted">
          Se crea con estado <span className="font-semibold text-body">Nuevo</span>. El resto de datos
          (empresa, canal, prioridad…) se completan luego desde la ficha.
        </p>
      </div>
    </div>
  );
}

function Etiqueta({
  children,
  obligatorio,
  opcional,
}: {
  children: React.ReactNode;
  obligatorio?: boolean;
  opcional?: boolean;
}) {
  return (
    <p className="mb-2 text-[13px] font-medium text-ink">
      {children}
      {obligatorio && <span className="text-danger"> *</span>}
      {opcional && <span className="font-normal text-muted"> (opcional)</span>}
    </p>
  );
}

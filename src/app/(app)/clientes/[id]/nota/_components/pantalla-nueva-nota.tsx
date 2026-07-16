"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { X, Phone, Calendar, Mail, MessageSquare, MapPin, Lock, Info } from "lucide-react";
import { api } from "../../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../../convex/_generated/dataModel";
import { useSesion, useGuardEscritura } from "@/components/session/use-sesion";
import { LABELS, type TipoInteraccion } from "@/lib/enums";
import { cn } from "@/lib/utils";

const TIPOS: { key: TipoInteraccion; icon: typeof Phone }[] = [
  { key: "llamada", icon: Phone },
  { key: "reunion", icon: Calendar },
  { key: "correo", icon: Mail },
  { key: "mensaje", icon: MessageSquare },
  { key: "visita", icon: MapPin },
  { key: "interno", icon: Lock },
];

const RESULTADOS = ["Pendiente", "Interesado", "No respondió", "Requiere seguimiento", "Cerrado"];

export function PantallaNuevaNota({ clienteId }: { clienteId: Id<"clientes"> }) {
  const { token } = useSesion();
  const puedeEditar = useGuardEscritura();
  const cliente = useQuery(api.clientes.detalle, { token, clienteId });

  if (!puedeEditar) return null; // observador: el guard ya redirige a Inicio (JUA-42)
  if (cliente === undefined) {
    return (
      <div className="flex flex-col gap-5 px-4 pt-16">
        <div className="h-28 animate-pulse rounded-[18px] bg-neutral-100" />
        <div className="h-40 animate-pulse rounded-[18px] bg-neutral-100" />
      </div>
    );
  }
  if (cliente === null) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="font-serif text-xl font-semibold text-ink">Cliente no encontrado</p>
        <Link href="/clientes" className="rounded-[22px] border border-border-input bg-surface px-5 py-2.5 text-[14px] font-semibold text-ink shadow-sm">
          Volver a clientes
        </Link>
      </div>
    );
  }

  return <Formulario clienteId={clienteId} nombre={cliente.nombre} token={token} />;
}

function Formulario({ clienteId, nombre, token }: { clienteId: Id<"clientes">; nombre: string; token: string }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoInteraccion>("llamada");
  const [descripcion, setDescripcion] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const crear = useMutation(api.notas.crear);

  const valido = descripcion.trim().length > 0;
  const volver = `/clientes/${clienteId}`;
  const inicial = nombre.trim().charAt(0).toUpperCase() || "?";

  const guardar = async () => {
    if (guardando || !valido) return;
    setGuardando(true);
    setError(null);
    try {
      await crear({ token, clienteId, tipo, descripcion, resultado: resultado ?? undefined });
      router.replace(volver);
    } catch (e) {
      console.error("No se pudo guardar la nota", e);
      setError("No se pudo guardar la nota. Inténtalo de nuevo.");
      setGuardando(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="relative flex h-14 items-center justify-center px-3.5">
        <button
          type="button"
          aria-label="Cancelar"
          onClick={() => router.push(volver)}
          className="absolute left-3.5 flex h-11 w-11 items-center justify-center rounded-xl border border-border-input bg-surface shadow-sm active:scale-95"
        >
          <X size={20} strokeWidth={2} className="text-ink" />
        </button>
        <h1 className="font-serif text-xl font-semibold text-ink">Nueva nota</h1>
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
        {/* Cliente (solo lectura) */}
        <div className="flex items-center gap-2 self-start rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2">
          <span className="text-[12.5px] text-body">Para:</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-tint text-[11px] font-semibold text-gold-700">
            {inicial}
          </span>
          <span className="text-[13.5px] font-semibold text-ink">{nombre}</span>
        </div>

        {/* Tipo de interacción */}
        <section>
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gold-text">Tipo de interacción</p>
          <div className="grid grid-cols-3 gap-2.5">
            {TIPOS.map(({ key, icon: Icon }) => {
              const activo = tipo === key;
              const esInterno = key === "interno";
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTipo(key)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border py-3 transition active:scale-95",
                    activo && esInterno
                      ? "border-teal-900 bg-teal-900 shadow-md"
                      : activo
                        ? "border-gold-500 bg-gold-tint shadow-[0_2px_10px_rgba(201,162,94,0.22)]"
                        : "border-border-input bg-surface",
                  )}
                >
                  <Icon
                    size={20}
                    strokeWidth={1.7}
                    className={activo && esInterno ? "text-[#F3ECDC]" : activo ? "text-gold-700" : "text-neutral-400"}
                  />
                  <span
                    className={cn(
                      "text-[12.5px] font-medium",
                      activo && esInterno ? "text-[#F3ECDC]" : activo ? "text-ink" : "text-body",
                    )}
                  >
                    {LABELS.tipoInteraccion[key]}
                  </span>
                </button>
              );
            })}
          </div>
          {tipo === "interno" && (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-[#E0C795] bg-[#F7F0E1] p-3">
              <Info size={17} strokeWidth={1.8} className="mt-0.5 flex-shrink-0 text-[#9A7327]" />
              <p className="text-[12.5px] leading-snug text-[#8A6A24]">
                Este comentario no actualizará el contador de días sin contacto de {nombre}.
              </p>
            </div>
          )}
        </section>

        {/* Nota */}
        <section>
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gold-text">Nota</p>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="¿Qué pasó en este contacto?"
            aria-label="Descripción de la nota"
            rows={5}
            autoFocus
            className="w-full resize-none rounded-xl border border-border-input bg-surface p-3.5 text-[14.5px] leading-relaxed text-ink outline-none transition placeholder:text-muted focus:border-gold-500 focus:ring-[3px] focus:ring-gold-500/[0.18]"
          />
        </section>

        {/* Resultado (opcional) */}
        <section>
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gold-text">
            Resultado <span className="font-normal normal-case text-muted">(opcional)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {RESULTADOS.map((r) => {
              const activo = resultado === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setResultado(activo ? null : r)}
                  className={cn(
                    "rounded-pill border px-3.5 py-1.5 text-[13px] font-medium transition active:scale-95",
                    activo ? "border-gold-500 bg-gold-tint text-gold-700" : "border-border-input bg-surface text-body",
                  )}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </section>

        {/* Fecha automática */}
        <div className="flex items-center gap-2.5 rounded-xl border border-neutral-100 bg-neutral-50 px-3.5 py-3">
          <Calendar size={18} strokeWidth={1.6} className="text-neutral-400" />
          <span className="flex-1 text-[13.5px] text-body">Fecha y hora</span>
          <span className="text-[13.5px] font-medium text-ink">Se guarda automáticamente</span>
        </div>

        {error && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-danger/30 bg-[#F9ECE7] p-3.5">
            <Info size={18} strokeWidth={1.9} className="flex-shrink-0 text-danger" />
            <p className="text-[13px] font-medium text-[#8A3F2C]">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

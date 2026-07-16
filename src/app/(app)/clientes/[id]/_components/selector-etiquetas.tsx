"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { Tag, Check, Plus, AlertCircle, Settings2 } from "lucide-react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { useSesion } from "@/components/session/use-sesion";
import { HojaInferior } from "@/components/ui/hoja-inferior";
import { cn } from "@/lib/utils";

// Etiquetas de producto del cliente (JUA-36), editables inline desde la ficha.
// Multiselección sobre el catálogo del negocio; ambos roles asignan. El admin
// además puede crear una etiqueta al vuelo o ir a gestionarlas (/etiquetas).

/** Lee el `data` de un ConvexError (llega también en prod); si no, fallback. */
const mensajeError = (e: unknown, fallback: string) => {
  const data = e && typeof e === "object" && "data" in e ? (e as { data: unknown }).data : undefined;
  return typeof data === "string" && data.trim() ? data.trim() : fallback;
};

export function SelectorEtiquetasCliente({
  clienteId,
  asignadas,
}: {
  clienteId: Id<"clientes">;
  asignadas: { _id: Id<"etiquetas">; nombre: string }[];
}) {
  const { token, rol } = useSesion();
  const esAdmin = rol === "admin";
  const catalogo = useQuery(api.etiquetas.listar, { token });
  const cambiar = useMutation(api.clientes.cambiarEtiquetas);
  const crear = useMutation(api.etiquetas.crear);

  const [abierta, setAbierta] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<Id<"etiquetas">>>(new Set());
  const [nueva, setNueva] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abrir = () => {
    setSeleccion(new Set(asignadas.map((e) => e._id)));
    setNueva("");
    setError(null);
    setAbierta(true);
  };

  const alternar = (id: Id<"etiquetas">) => {
    setSeleccion((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  const crearYSeleccionar = async () => {
    const nombre = nueva.trim();
    if (!nombre || creando) return;
    setCreando(true);
    setError(null);
    try {
      const id = await crear({ token, nombre });
      setSeleccion((prev) => new Set(prev).add(id));
      setNueva("");
    } catch (e) {
      console.error("No se pudo crear la etiqueta", e);
      setError(mensajeError(e, "No se pudo crear la etiqueta."));
    } finally {
      setCreando(false);
    }
  };

  const guardar = async () => {
    if (ocupado) return;
    setOcupado(true);
    setError(null);
    try {
      await cambiar({ token, clienteId, etiquetaIds: [...seleccion] });
      setAbierta(false);
    } catch (e) {
      console.error("No se pudieron guardar las etiquetas", e);
      setError("No se pudieron guardar las etiquetas. Inténtalo de nuevo.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <>
      {/* Fila en la tarjeta de perfil */}
      <div className="flex w-full items-center gap-3">
        <Tag size={18} strokeWidth={1.6} className="text-neutral-400" />
        <span className="flex-1 text-[14.5px] text-ink">Etiquetas de producto</span>
        <button
          type="button"
          aria-label="Editar etiquetas de producto"
          aria-haspopup="dialog"
          onClick={abrir}
          className="rounded-lg border border-dashed border-border-input bg-surface px-2.5 py-1 text-[12px] font-semibold text-muted transition active:scale-95"
        >
          {asignadas.length > 0 ? "Editar" : "Añadir"}
        </button>
      </div>
      {asignadas.length > 0 && (
        <div className="mt-2.5 flex w-full flex-wrap gap-1.5">
          {asignadas.map((e) => (
            <span
              key={e._id}
              className="rounded-pill border border-gold-tint-border/60 bg-gold-tint px-2.5 py-1 text-[12px] font-semibold text-gold-700"
            >
              {e.nombre}
            </span>
          ))}
        </div>
      )}

      <HojaInferior
        abierta={abierta}
        onCerrar={() => setAbierta(false)}
        titulo={
          <div>
            <p className="font-serif text-lg font-semibold text-ink">Etiquetas de producto</p>
            <p className="mt-1 text-[13px] leading-snug text-body">
              Clasifica al cliente por producto comprado o de interés. Puedes elegir varias.
            </p>
          </div>
        }
      >
        <div className="flex flex-col gap-2 pt-1">
          {catalogo === undefined ? (
            <p className="py-4 text-center text-[13.5px] text-muted">Cargando…</p>
          ) : (catalogo ?? []).length === 0 ? (
            <p className="rounded-xl border border-neutral-100 bg-neutral-50/60 px-3 py-3 text-[13px] leading-snug text-body">
              Aún no hay etiquetas en el catálogo.{" "}
              {esAdmin ? "Crea la primera aquí abajo." : "Pide a tu administradora que las cree."}
            </p>
          ) : (
            <div className={cn("flex flex-col gap-2", (catalogo ?? []).length > 6 && "max-h-72 overflow-y-auto")}>
              {(catalogo ?? []).map((e) => {
                const activa = seleccion.has(e._id);
                return (
                  <button
                    key={e._id}
                    type="button"
                    disabled={ocupado}
                    onClick={() => alternar(e._id)}
                    className={cn(
                      "flex items-center gap-3 rounded-[14px] border p-3.5 text-left transition active:scale-[0.99] disabled:opacity-60",
                      activa ? "border-[1.5px] border-gold-500 bg-gold-tint" : "border-border-input bg-surface",
                    )}
                  >
                    <Tag size={16} strokeWidth={1.8} className={activa ? "text-gold-700" : "text-neutral-400"} />
                    <span className="flex-1 truncate text-[15px] font-medium text-ink">{e.nombre}</span>
                    {activa && <Check size={18} strokeWidth={2.4} className="text-gold-700" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Crear al vuelo (solo admin, JUA-36: catálogo configurable por Marta) */}
          {esAdmin && (
            <div className="mt-1 flex gap-2">
              <input
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void crearYSeleccionar();
                  }
                }}
                placeholder="Nueva etiqueta (ej. Formación)"
                aria-label="Nombre de la nueva etiqueta"
                maxLength={30}
                className="h-11 w-full rounded-xl border border-border-input px-3 text-[14.5px] text-ink outline-none transition focus:border-gold-500 focus:ring-[3px] focus:ring-gold-500/[0.18] placeholder:text-muted"
              />
              <button
                type="button"
                aria-label="Crear etiqueta"
                aria-busy={creando}
                disabled={!nueva.trim() || creando}
                onClick={() => void crearYSeleccionar()}
                className={cn(
                  "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition active:scale-95",
                  nueva.trim() && !creando
                    ? "bg-gold-500 text-ink shadow-[0_2px_6px_rgba(201,162,94,0.32)]"
                    : "cursor-not-allowed bg-neutral-100 text-muted",
                )}
              >
                <Plus size={18} strokeWidth={2.2} />
              </button>
            </div>
          )}

          {error && (
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-danger/30 bg-[#F9ECE7] px-3 py-2.5">
              <AlertCircle size={16} strokeWidth={1.9} className="flex-shrink-0 text-danger" />
              <p className="text-[12.5px] font-medium text-[#8A3F2C]">{error}</p>
            </div>
          )}

          <button
            type="button"
            disabled={ocupado}
            aria-busy={ocupado}
            onClick={() => void guardar()}
            className="mt-1 flex h-12 w-full items-center justify-center rounded-xl bg-gold-500 text-[15px] font-bold text-ink shadow-[0_2px_8px_rgba(201,162,94,0.32)] transition active:scale-[0.99] disabled:opacity-60"
          >
            {ocupado ? "Guardando…" : "Guardar etiquetas"}
          </button>

          {esAdmin && (
            <Link
              href="/etiquetas"
              className="flex items-center justify-center gap-1.5 py-2 text-[13px] font-medium text-teal-800 underline-offset-2 active:underline"
            >
              <Settings2 size={14} strokeWidth={1.9} />
              Gestionar etiquetas del negocio
            </Link>
          )}
        </div>
      </HojaInferior>
    </>
  );
}

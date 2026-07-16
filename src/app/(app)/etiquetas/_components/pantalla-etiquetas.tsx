"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ChevronLeft, Tag, Plus, Pencil, Trash2, AlertCircle } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { useSesion } from "@/components/session/use-sesion";
import { EsqueletoLista } from "@/components/ui/esqueleto-lista";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { HojaInferior } from "@/components/ui/hoja-inferior";
import { HojaConfirmar } from "@/components/ui/hoja-confirmar";
import { cn } from "@/lib/utils";

// Gestión de etiquetas de producto (JUA-36). Solo admin (Marta): crear,
// renombrar y eliminar las etiquetas con las que se clasifican los clientes.
// Eliminar una etiqueta la quita de todos los clientes que la tengan.

/** Lee el `data` de un ConvexError (llega también en prod); si no, fallback. */
const mensajeError = (e: unknown, fallback: string) => {
  const data = e && typeof e === "object" && "data" in e ? (e as { data: unknown }).data : undefined;
  return typeof data === "string" && data.trim() ? data.trim() : fallback;
};

type Etiqueta = { _id: Id<"etiquetas">; nombre: string; clientes: number };

export function PantallaEtiquetas() {
  const router = useRouter();
  const { token, rol } = useSesion();
  const esAdmin = rol === "admin";
  const etiquetas = useQuery(api.etiquetas.listar, esAdmin ? { token } : "skip");
  const crear = useMutation(api.etiquetas.crear);
  const renombrar = useMutation(api.etiquetas.renombrar);
  const eliminar = useMutation(api.etiquetas.eliminar);

  const [nueva, setNueva] = useState("");
  const [creando, setCreando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aRenombrar, setARenombrar] = useState<Etiqueta | null>(null);
  const [nombreEdit, setNombreEdit] = useState("");
  const [aEliminar, setAEliminar] = useState<Etiqueta | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [errorHoja, setErrorHoja] = useState<string | null>(null);

  // Guard de ruta (JUA-30): la pantalla es solo del rol admin.
  useEffect(() => {
    if (!esAdmin) router.replace("/inicio");
  }, [esAdmin, router]);
  if (!esAdmin) return null;

  const crearEtiqueta = async () => {
    const nombre = nueva.trim();
    if (!nombre || creando) return;
    setCreando(true);
    setAviso(null);
    try {
      await crear({ token, nombre });
      setNueva("");
    } catch (e) {
      console.error("No se pudo crear la etiqueta", e);
      setAviso(mensajeError(e, "No se pudo crear la etiqueta."));
    } finally {
      setCreando(false);
    }
  };

  const guardarNombre = async () => {
    if (!aRenombrar || ocupado) return;
    setOcupado(true);
    setErrorHoja(null);
    try {
      await renombrar({ token, etiquetaId: aRenombrar._id, nombre: nombreEdit });
      setARenombrar(null);
    } catch (e) {
      console.error("No se pudo renombrar la etiqueta", e);
      setErrorHoja(mensajeError(e, "No se pudo renombrar la etiqueta."));
    } finally {
      setOcupado(false);
    }
  };

  const eliminarEtiqueta = async () => {
    if (!aEliminar || ocupado) return;
    setOcupado(true);
    setErrorHoja(null);
    try {
      await eliminar({ token, etiquetaId: aEliminar._id });
      setAEliminar(null);
    } catch (e) {
      console.error("No se pudo eliminar la etiqueta", e);
      setErrorHoja("No se pudo eliminar la etiqueta. Inténtalo de nuevo.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <header className="relative flex h-14 items-center justify-between px-4">
        <button
          type="button"
          aria-label="Volver"
          onClick={() => router.back()}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-input bg-surface shadow-sm active:scale-95"
        >
          <ChevronLeft size={20} strokeWidth={2} className="text-ink" />
        </button>
        <h1 className="font-serif text-xl font-semibold text-ink">Etiquetas de producto</h1>
        <div className="h-11 w-11" aria-hidden />
      </header>

      <div className="flex flex-col gap-4 px-4 pt-2 pb-10">
        <p className="px-1 text-[12.5px] leading-snug text-muted">
          Clasifican a los clientes por producto comprado o de interés. Se asignan desde la ficha
          del cliente y filtran la lista.
        </p>

        {/* Crear */}
        <div className="flex gap-2">
          <input
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void crearEtiqueta();
              }
            }}
            placeholder="Nueva etiqueta (ej. Formación)"
            aria-label="Nombre de la nueva etiqueta"
            maxLength={30}
            className="h-12 w-full rounded-xl border border-border-input bg-surface px-3 text-[15px] text-ink outline-none transition focus:border-gold-500 focus:ring-[3px] focus:ring-gold-500/[0.18] placeholder:text-muted"
          />
          <button
            type="button"
            aria-label="Crear etiqueta"
            aria-busy={creando}
            disabled={!nueva.trim() || creando}
            onClick={() => void crearEtiqueta()}
            className={cn(
              "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl transition active:scale-95",
              nueva.trim() && !creando
                ? "bg-gold-500 text-ink shadow-[0_2px_6px_rgba(201,162,94,0.32)]"
                : "cursor-not-allowed bg-neutral-100 text-muted",
            )}
          >
            <Plus size={19} strokeWidth={2.2} />
          </button>
        </div>

        {aviso && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-danger/30 bg-[#F9ECE7] p-3.5">
            <AlertCircle size={18} strokeWidth={1.9} className="flex-shrink-0 text-danger" />
            <p className="text-[13px] font-medium text-[#8A3F2C]">{aviso}</p>
          </div>
        )}

        {/* Catálogo */}
        {etiquetas === undefined || etiquetas === null ? (
          <EsqueletoLista />
        ) : etiquetas.length === 0 ? (
          <EstadoVacio
            icono={<Tag size={30} strokeWidth={1.5} className="text-neutral-400" />}
            titulo="Aún no hay etiquetas"
            subtitulo="Crea la primera con el nombre de un producto de tu catálogo."
          />
        ) : (
          <section>
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gold-text">
              Catálogo · {etiquetas.length} {etiquetas.length === 1 ? "etiqueta" : "etiquetas"}
            </p>
            <div className="flex flex-col gap-2.5">
              {etiquetas.map((e) => (
                <div
                  key={e._id}
                  className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-surface p-3.5 shadow-sm"
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gold-tint">
                    <Tag size={17} strokeWidth={1.8} className="text-gold-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink">{e.nombre}</p>
                    <p className="mt-0.5 text-[12.5px] text-muted">
                      {e.clientes} {e.clientes === 1 ? "cliente" : "clientes"}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 gap-1.5">
                    <button
                      type="button"
                      aria-label={`Renombrar ${e.nombre}`}
                      onClick={() => {
                        setErrorHoja(null);
                        setNombreEdit(e.nombre);
                        setARenombrar(e);
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-border-input text-body active:scale-95 active:bg-row-hover"
                    >
                      <Pencil size={15} strokeWidth={1.9} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Eliminar ${e.nombre}`}
                      onClick={() => {
                        setErrorHoja(null);
                        setAEliminar(e);
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-danger/30 text-danger active:scale-95 active:bg-[#F9ECE7]"
                    >
                      <Trash2 size={15} strokeWidth={1.9} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Renombrar */}
      <HojaInferior
        abierta={aRenombrar !== null}
        onCerrar={() => setARenombrar(null)}
        titulo={<p className="font-serif text-lg font-semibold text-ink">Renombrar etiqueta</p>}
      >
        <div className="flex flex-col gap-3 pt-1">
          <input
            value={nombreEdit}
            onChange={(e) => setNombreEdit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void guardarNombre();
              }
            }}
            aria-label="Nuevo nombre de la etiqueta"
            maxLength={30}
            className="h-12 w-full rounded-xl border border-border-input px-3 text-[15px] text-ink outline-none transition focus:border-gold-500 focus:ring-[3px] focus:ring-gold-500/[0.18]"
          />
          {errorHoja && aRenombrar && (
            <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-[#F9ECE7] px-3 py-2.5">
              <AlertCircle size={16} strokeWidth={1.9} className="flex-shrink-0 text-danger" />
              <p className="text-[12.5px] font-medium text-[#8A3F2C]">{errorHoja}</p>
            </div>
          )}
          <button
            type="button"
            disabled={!nombreEdit.trim() || ocupado}
            aria-busy={ocupado}
            onClick={() => void guardarNombre()}
            className={cn(
              "flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-bold transition active:scale-[0.99]",
              nombreEdit.trim() && !ocupado
                ? "bg-gold-500 text-ink shadow-[0_2px_8px_rgba(201,162,94,0.32)]"
                : "cursor-not-allowed bg-neutral-100 text-muted",
            )}
          >
            {ocupado ? "Guardando…" : "Guardar nombre"}
          </button>
        </div>
      </HojaInferior>

      {/* Eliminar */}
      <HojaConfirmar
        abierta={aEliminar !== null}
        titulo="¿Eliminar etiqueta?"
        mensaje={
          aEliminar
            ? aEliminar.clientes > 0
              ? `"${aEliminar.nombre}" se eliminará del catálogo y se quitará de ${aEliminar.clientes} ${aEliminar.clientes === 1 ? "cliente" : "clientes"}.`
              : `"${aEliminar.nombre}" se eliminará del catálogo. Ningún cliente la tiene asignada.`
            : ""
        }
        textoConfirmar="Eliminar"
        tono="danger"
        ocupado={ocupado}
        error={aEliminar ? errorHoja : null}
        onConfirmar={() => void eliminarEtiqueta()}
        onCerrar={() => setAEliminar(null)}
      />
    </div>
  );
}

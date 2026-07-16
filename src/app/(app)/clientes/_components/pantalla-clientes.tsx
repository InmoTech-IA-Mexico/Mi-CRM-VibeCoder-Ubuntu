"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { Plus, Search, Tag, Users, X } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { useSesion, usePuedeEditar } from "@/components/session/use-sesion";
import { MenuPerfil } from "@/components/layout/menu-perfil";
import { EsqueletoLista } from "@/components/ui/esqueleto-lista";
import { PRIORIDAD_ESTILO } from "@/components/ui/indicador-prioridad";
import { TarjetaCliente } from "./tarjeta-cliente";
import { ESTADOS_CLIENTE, LABELS, type EstadoCliente } from "@/lib/enums";
import { cn } from "@/lib/utils";

// Chips de filtro rápido: por estado (sin punto), por prioridad del cliente
// (con punto de color, JUA-47) y por etiqueta de producto (dinámicos, JUA-36).
// Selección única; se combina con el buscador.
const CHIPS = [
  { key: "todos", label: "Todos", dot: null },
  { key: "activos", label: "Activos", dot: null },
  { key: "prospectos", label: "Prospectos", dot: null },
  { key: "alta", label: "Alta", dot: PRIORIDAD_ESTILO.alta.punto },
  { key: "media", label: "Media", dot: PRIORIDAD_ESTILO.media.punto },
  { key: "baja", label: "Baja", dot: PRIORIDAD_ESTILO.baja.punto },
] as const;
// Chip fijo o etiqueta de producto ("etq:<id>").
type Chip = (typeof CHIPS)[number]["key"] | `etq:${string}`;

const OCULTAR_SCROLL = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export function PantallaClientes({ estadoInicial }: { estadoInicial?: string }) {
  const { token, rol } = useSesion();
  const esAdmin = rol === "admin";
  const [busqueda, setBusqueda] = useState("");
  const [chip, setChip] = useState<Chip>("todos");
  // Toggle "Mis clientes / Todos" (JUA-43), solo admin: filtra por su cartera.
  const [soloMios, setSoloMios] = useState(false);
  // Filtro por estado desde el dashboard (JUA-35). Prevalece sobre los chips.
  const estadoValido = (ESTADOS_CLIENTE as readonly string[]).includes(estadoInicial ?? "")
    ? (estadoInicial as EstadoCliente)
    : null;
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoCliente | null>(estadoValido);
  const [ahora] = useState(() => Date.now());

  const clientes = useQuery(api.clientes.listar, esAdmin ? { token, soloMios } : { token });
  const etiquetas = useQuery(api.etiquetas.listar, { token });

  const q = busqueda.trim().toLowerCase();
  // Filtro por etiqueta de producto (JUA-36): el chip lleva el id ("etq:<id>").
  const etiquetaFiltro = chip.startsWith("etq:") ? chip.slice(4) : null;
  const porChip = (clientes ?? []).filter((c) =>
    estadoFiltro
      ? c.estado === estadoFiltro
      : etiquetaFiltro
        ? c.etiquetaIds.some((id) => id === etiquetaFiltro)
        : chip === "activos"
          ? c.estado === "activo"
          : chip === "prospectos"
            ? c.estado === "prospecto"
            : chip === "alta" || chip === "media" || chip === "baja"
              ? c.prioridad === chip
              : true,
  );
  const visibles = q
    ? porChip.filter((c) =>
        [c.nombre, c.telefono, c.email, c.empresa].some((v) => v?.toLowerCase().includes(q)),
      )
    : porChip;

  return (
    <div className="px-4 pt-2">
      {/* Header */}
      <header className="flex items-center justify-between py-2">
        <div className="flex items-baseline gap-2">
          <h1 className="font-serif text-2xl font-semibold text-ink">Clientes</h1>
          {clientes && (
            <span className="text-[13px] font-semibold tabular-nums text-gold-text">{clientes.length}</span>
          )}
        </div>
        <MenuPerfil />
      </header>

      {/* Toggle de cartera (JUA-43), solo admin: Todos / Mis clientes */}
      {esAdmin && (
        <div className="mt-1.5 flex rounded-pill border border-border-input bg-neutral-50 p-0.5 text-[13px] font-semibold">
          <button
            type="button"
            aria-pressed={!soloMios}
            onClick={() => setSoloMios(false)}
            className={cn(
              "flex-1 rounded-pill py-1.5 transition",
              !soloMios ? "bg-surface text-ink shadow-sm" : "text-muted",
            )}
          >
            Todos
          </button>
          <button
            type="button"
            aria-pressed={soloMios}
            onClick={() => setSoloMios(true)}
            className={cn(
              "flex-1 rounded-pill py-1.5 transition",
              soloMios ? "bg-surface text-ink shadow-sm" : "text-muted",
            )}
          >
            Mis clientes
          </button>
        </div>
      )}

      {/* Buscador (tiempo real) */}
      <div
        className={cn(
          "mt-1.5 flex h-11 items-center gap-2.5 rounded-input border bg-surface px-3 transition",
          q ? "border-gold-500 ring-[3px] ring-gold-500/[0.18]" : "border-border-input",
        )}
      >
        <Search size={18} strokeWidth={1.6} className={q ? "text-gold-700" : "text-neutral-400"} />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar clientes..."
          aria-label="Buscar clientes"
          className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
        />
        {busqueda && (
          <button
            type="button"
            aria-label="Limpiar búsqueda"
            onClick={() => setBusqueda("")}
            className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full bg-neutral-50 text-body"
          >
            <X size={13} strokeWidth={2.2} />
          </button>
        )}
      </div>

      {/* Filtro por estado (desde el dashboard) o chips de filtro rápido */}
      {estadoFiltro ? (
        <div className="mt-3.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-gold-500 bg-gold-tint px-3 py-1.5 text-[13px] font-medium text-gold-700">
            {LABELS.estadoCliente[estadoFiltro]}
            <button
              type="button"
              aria-label="Quitar filtro"
              onClick={() => setEstadoFiltro(null)}
              className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-gold-500/20"
            >
              <X size={12} strokeWidth={2.4} />
            </button>
          </span>
          <span className="text-[12.5px] text-muted">Filtrando por estado</span>
        </div>
      ) : (
        <div className={cn("-mx-4 mt-3.5 flex gap-2 overflow-x-auto px-4", OCULTAR_SCROLL)}>
          {CHIPS.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={chip === c.key}
              onClick={() => setChip(c.key)}
              className={cn(
                "inline-flex flex-none items-center gap-1.5 rounded-pill border px-3.5 py-1.5 text-[13px] font-medium",
                chip === c.key
                  ? "border-gold-500 bg-gold-tint text-gold-700"
                  : "border-border-input bg-surface text-body",
              )}
            >
              {c.dot && <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", c.dot)} />}
              {c.label}
            </button>
          ))}
          {/* Etiquetas de producto del negocio (JUA-36), con su nº de clientes */}
          {(etiquetas ?? []).map((e) => {
            const key: Chip = `etq:${e._id}`;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={chip === key}
                onClick={() => setChip(key)}
                className={cn(
                  "inline-flex flex-none items-center gap-1.5 rounded-pill border px-3.5 py-1.5 text-[13px] font-medium",
                  chip === key
                    ? "border-gold-500 bg-gold-tint text-gold-700"
                    : "border-border-input bg-surface text-body",
                )}
              >
                <Tag size={12} strokeWidth={2} className="flex-shrink-0" />
                {e.nombre}
                <span className={cn("text-[11.5px] tabular-nums", chip === key ? "text-gold-700/70" : "text-muted")}>
                  {e.clientes}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Lista / estados */}
      <div className="mt-3.5">
        {clientes === undefined ? (
          <EsqueletoLista />
        ) : clientes.length === 0 ? (
          <ListaVacia />
        ) : visibles.length === 0 ? (
          <SinResultados busqueda={busqueda} />
        ) : (
          <>
            {q && (
              <p className="mb-3 text-[12.5px] text-muted">
                {visibles.length} {visibles.length === 1 ? "resultado" : "resultados"} para{" "}
                <span className="font-semibold text-body">&ldquo;{busqueda}&rdquo;</span>
              </p>
            )}
            <div className="flex flex-col gap-2.5">
              {visibles.map((c) => (
                <TarjetaCliente key={c._id} item={c} busqueda={busqueda} ahora={ahora} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SinResultados({ busqueda }: { busqueda: string }) {
  const puedeEditar = usePuedeEditar();
  return (
    <div className="flex flex-col items-center px-8 pt-16 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-[24px] border border-neutral-100 bg-neutral-50">
        <Search size={38} strokeWidth={1.5} className="text-neutral-400" />
      </div>
      <p className="text-[16px] font-semibold text-ink">
        {busqueda ? <>No encontramos &ldquo;{busqueda}&rdquo;</> : "No se encontraron clientes"}
      </p>
      <p className="mt-1.5 text-[13px] text-muted">Prueba con otro nombre o empresa</p>
      {puedeEditar && (
        <Link
          href="/clientes/nuevo"
          className="mt-5 inline-flex items-center gap-2 rounded-[24px] border border-border-input bg-surface px-[18px] py-2.5 text-[14px] font-semibold text-ink shadow-sm active:scale-[0.99]"
        >
          <Plus size={16} strokeWidth={1.9} />
          Crear nuevo cliente
        </Link>
      )}
    </div>
  );
}

/** Estado de lista totalmente vacía (aún no hay ningún cliente) — JUA-31. */
function ListaVacia() {
  const puedeEditar = usePuedeEditar();
  return (
    <div className="flex flex-col items-center px-8 pt-16 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-[24px] border border-neutral-100 bg-neutral-50">
        <Users size={36} strokeWidth={1.5} className="text-neutral-400" />
      </div>
      <p className="text-[16px] font-semibold text-ink">
        {puedeEditar ? "Aún no tienes clientes" : "Todavía no hay clientes"}
      </p>
      {puedeEditar ? (
        <>
          <p className="mt-1.5 text-[13px] text-muted">Añade el primero para empezar a darles seguimiento.</p>
          <Link
            href="/clientes/nuevo"
            className="mt-5 inline-flex items-center gap-2 rounded-[24px] bg-gold-500 px-5 py-2.5 text-[14px] font-bold text-ink shadow-[0_2px_8px_rgba(201,162,94,0.32)] active:scale-[0.99]"
          >
            <Plus size={16} strokeWidth={2} />
            Añadir el primer cliente
          </Link>
        </>
      ) : (
        <p className="mt-1.5 text-[13px] text-muted">Cuando el equipo dé de alta clientes, aparecerán aquí.</p>
      )}
    </div>
  );
}

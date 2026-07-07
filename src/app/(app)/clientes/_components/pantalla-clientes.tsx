"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { Plus, Search, X } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { useSesion } from "@/components/session/use-sesion";
import { MenuPerfil } from "@/components/layout/menu-perfil";
import { EsqueletoLista } from "@/components/ui/esqueleto-lista";
import { TarjetaCliente } from "./tarjeta-cliente";
import { cn } from "@/lib/utils";

const CHIPS = [
  { key: "todos", label: "Todos" },
  { key: "activos", label: "Activos" },
  { key: "prospectos", label: "Prospectos" },
  { key: "alta", label: "Alta prioridad" },
] as const;
type Chip = (typeof CHIPS)[number]["key"];

const OCULTAR_SCROLL = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export function PantallaClientes() {
  const { token } = useSesion();
  const [busqueda, setBusqueda] = useState("");
  const [chip, setChip] = useState<Chip>("todos");
  const [ahora] = useState(() => Date.now());

  const clientes = useQuery(api.clientes.listar, { token });

  const q = busqueda.trim().toLowerCase();
  const porChip = (clientes ?? []).filter((c) =>
    chip === "activos"
      ? c.estado === "activo"
      : chip === "prospectos"
        ? c.estado === "prospecto"
        : chip === "alta"
          ? c.prioridad === "alta"
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

      {/* Chips de filtro rápido */}
      <div className={cn("-mx-4 mt-3.5 flex gap-2 overflow-x-auto px-4", OCULTAR_SCROLL)}>
        {CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setChip(c.key)}
            className={cn(
              "flex-none rounded-pill border px-3.5 py-1.5 text-[13px] font-medium",
              chip === c.key
                ? "border-gold-500 bg-gold-tint text-gold-700"
                : "border-border-input bg-surface text-body",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Lista / estados */}
      <div className="mt-3.5">
        {clientes === undefined ? (
          <EsqueletoLista />
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
  return (
    <div className="flex flex-col items-center px-8 pt-16 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-[24px] border border-neutral-100 bg-neutral-50">
        <Search size={38} strokeWidth={1.5} className="text-neutral-400" />
      </div>
      <p className="text-[16px] font-semibold text-ink">
        {busqueda ? <>No encontramos &ldquo;{busqueda}&rdquo;</> : "No se encontraron clientes"}
      </p>
      <p className="mt-1.5 text-[13px] text-muted">Prueba con otro nombre o empresa</p>
      <Link
        href="/clientes/nuevo"
        className="mt-5 inline-flex items-center gap-2 rounded-[24px] border border-border-input bg-surface px-[18px] py-2.5 text-[14px] font-semibold text-ink shadow-sm active:scale-[0.99]"
      >
        <Plus size={16} strokeWidth={1.9} />
        Crear nuevo cliente
      </Link>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { UserRound, Check, ChevronDown, AlertCircle } from "lucide-react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { useSesion } from "@/components/session/use-sesion";
import { HojaInferior } from "@/components/ui/hoja-inferior";
import { LABELS } from "@/lib/enums";
import { cn } from "@/lib/utils";

// Responsable de la cartera del cliente (JUA-43). Todos ven de quién es; solo el
// admin lo asigna/reasigna/desasigna. El pool "sin asignar" solo lo ve el admin.
// La seguridad real vive en el servidor (`clientes.asignarResponsable`).

export function SelectorResponsableCliente({
  clienteId,
  responsable,
}: {
  clienteId: Id<"clientes">;
  responsable: { _id: Id<"usuarios">; nombre: string } | null;
}) {
  const { token, rol } = useSesion();
  const esAdmin = rol === "admin";
  const equipo = useQuery(api.usuarios.equipo, esAdmin ? { token } : "skip");
  const asignar = useMutation(api.clientes.asignarResponsable);

  const [abierta, setAbierta] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const elegir = async (nuevo: Id<"usuarios"> | null) => {
    if (ocupado) return;
    if (nuevo === (responsable?._id ?? null)) return setAbierta(false);
    setOcupado(true);
    setError(null);
    try {
      await asignar({ token, clienteId, responsableId: nuevo });
      setAbierta(false);
    } catch (e) {
      console.error("No se pudo asignar el responsable", e);
      setError("No se pudo cambiar el responsable. Inténtalo de nuevo.");
    } finally {
      setOcupado(false);
    }
  };

  // Fila en la tarjeta de perfil.
  const fila = (
    <div className="flex w-full items-center gap-3">
      <UserRound size={18} strokeWidth={1.6} className="text-neutral-400" />
      <span className="flex-1 text-[14.5px] text-ink">Responsable</span>
      {esAdmin ? (
        <button
          type="button"
          aria-label="Cambiar responsable del cliente"
          aria-haspopup="dialog"
          aria-busy={ocupado}
          disabled={ocupado}
          onClick={() => {
            setError(null);
            setAbierta(true);
          }}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition active:scale-95 disabled:opacity-60",
            responsable ? "bg-[#E2EDEE]" : "border border-dashed border-border-input bg-surface",
          )}
        >
          <span className={cn("text-[12.5px] font-semibold", responsable ? "text-[#1C4E55]" : "text-muted")}>
            {responsable ? responsable.nombre : "Sin asignar"}
          </span>
          <ChevronDown size={12} strokeWidth={2.2} className={responsable ? "text-[#1C4E55]" : "text-muted"} />
        </button>
      ) : responsable ? (
        <span className="text-[13.5px] font-medium text-body">{responsable.nombre}</span>
      ) : (
        <span className="text-[13.5px] text-muted">Sin asignar</span>
      )}
    </div>
  );

  if (!esAdmin) return fila;

  const miembros = equipo?.usuarios ?? [];

  return (
    <>
      {fila}
      <HojaInferior
        abierta={abierta}
        onCerrar={() => setAbierta(false)}
        titulo={
          <div>
            <p className="font-serif text-lg font-semibold text-ink">Responsable del cliente</p>
            <p className="mt-1 text-[13px] leading-snug text-body">
              El vendedor asignado ve este cliente en su cartera. Sin asignar, solo lo ves tú.
            </p>
          </div>
        }
      >
        <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pt-1">
          {/* Opción "Sin asignar" (pool) */}
          <Opcion
            activo={responsable == null}
            nombre="Sin asignar"
            subtitulo="Queda en el pool, solo visible para ti"
            ocupado={ocupado}
            onClick={() => elegir(null)}
          />
          {miembros.map((u) => (
            <Opcion
              key={u._id}
              activo={responsable?._id === u._id}
              nombre={u.esYo ? `${u.nombre} (tú)` : u.nombre}
              subtitulo={`${LABELS.rol[u.rol]} · ${u.clientes} ${u.clientes === 1 ? "cliente" : "clientes"}`}
              ocupado={ocupado}
              onClick={() => elegir(u._id)}
            />
          ))}

          {error && (
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-danger/30 bg-[#F9ECE7] px-3 py-2.5">
              <AlertCircle size={16} strokeWidth={1.9} className="flex-shrink-0 text-danger" />
              <p className="text-[12.5px] font-medium text-[#8A3F2C]">{error}</p>
            </div>
          )}
        </div>
      </HojaInferior>
    </>
  );
}

function Opcion({
  activo,
  nombre,
  subtitulo,
  ocupado,
  onClick,
}: {
  activo: boolean;
  nombre: string;
  subtitulo: string;
  ocupado: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={ocupado}
      aria-pressed={activo}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-[14px] border p-3.5 text-left transition active:scale-[0.99] disabled:opacity-60",
        activo ? "border-[1.5px] border-gold-500 bg-gold-tint" : "border-border-input bg-surface",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-ink">{nombre}</p>
        <p className="truncate text-[12px] text-muted">{subtitulo}</p>
      </div>
      {activo && <Check size={18} strokeWidth={2.4} className="flex-shrink-0 text-gold-700" />}
    </button>
  );
}

import type { FunctionReturnType } from "convex/server";
import { Phone, Mail, MessageCircle, MapPin } from "lucide-react";
import { api } from "../../../../../../convex/_generated/api";
import { BadgeEstado } from "@/components/ui/badge-estado";
import { LABELS } from "@/lib/enums";
import { diasDesde, colorUrgenciaDias } from "@/lib/fechas";
import { SelectorPrioridadCliente } from "./selector-prioridad";
import { SelectorEtiquetasCliente } from "./selector-etiquetas";
import { SelectorResponsableCliente } from "./selector-responsable";
import { cn } from "@/lib/utils";

export type FichaCliente = NonNullable<FunctionReturnType<typeof api.clientes.detalle>>;

export function TarjetaPerfil({ cliente, ahora }: { cliente: FichaCliente; ahora: number }) {
  const inicial = cliente.nombre.trim().charAt(0).toUpperCase() || "?";
  const esNuevo = cliente.estado === "nuevo";
  const dias = cliente.ultimaInteraccion != null ? diasDesde(cliente.ultimaInteraccion, ahora) : null;

  return (
    <div className="flex flex-col items-center rounded-[18px] border border-neutral-100 bg-surface p-5 shadow-sm">
      {/* Avatar */}
      <div
        className={cn(
          "flex h-[72px] w-[72px] items-center justify-center rounded-full",
          esNuevo ? "bg-neutral-100" : "bg-gradient-to-br from-[#D2B074] to-[#B68E45] shadow-[0_6px_18px_rgba(201,162,94,0.40)]",
        )}
      >
        <span className={cn("font-serif text-[30px] font-bold", esNuevo ? "text-[#6B7268]" : "text-white")}>
          {inicial}
        </span>
      </div>

      <h2 className="mt-3.5 font-serif text-2xl font-semibold tracking-tight text-ink">{cliente.nombre}</h2>
      <p className="mt-0.5 text-[13px] text-muted">{cliente.empresa ?? "—"}</p>

      <div className="mt-3.5 flex items-center gap-2">
        <BadgeEstado estado={cliente.estado} />
        {/* Prioridad estratégica editable inline (JUA-46). */}
        <SelectorPrioridadCliente clienteId={cliente._id} prioridad={cliente.prioridad} />
      </div>

      <p
        className={cn(
          "mt-3 text-[12.5px] font-semibold",
          dias == null ? "text-muted" : dias === 0 ? "text-success" : colorUrgenciaDias(dias),
        )}
      >
        {dias == null
          ? "Sin contacto registrado aún"
          : dias === 0
            ? "Contactado hoy"
            : `Hace ${dias} ${dias === 1 ? "día" : "días"} sin contacto`}
      </p>

      {/* Contacto */}
      {(cliente.telefono || cliente.email) && <div className="my-4 h-px w-full bg-neutral-100" />}

      {cliente.telefono && (
        <FilaContacto
          icono={<Phone size={18} strokeWidth={1.6} className="text-neutral-400" />}
          valor={<span className="tabular-nums">{cliente.telefono}</span>}
          accion={
            <a
              href={`tel:${cliente.telefono.replace(/\s/g, "")}`}
              aria-label="Llamar"
              className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-[#2E7D6B]/28 bg-[#E2EFEB] active:scale-95"
            >
              <Phone size={17} strokeWidth={1.8} className="text-success" />
            </a>
          }
        />
      )}

      {cliente.email && (
        <FilaContacto
          className={cliente.telefono ? "mt-3.5" : undefined}
          icono={<Mail size={18} strokeWidth={1.6} className="text-neutral-400" />}
          valor={<span className="truncate">{cliente.email}</span>}
          accion={
            <a
              href={`mailto:${cliente.email}`}
              aria-label="Enviar email"
              className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-[#C9DDDF] bg-[#E2EDEE] active:scale-95"
            >
              <Mail size={17} strokeWidth={1.8} className="text-[#1C4E55]" />
            </a>
          }
        />
      )}

      {/* Canal */}
      <div className="my-4 h-px w-full bg-neutral-100" />
      <div className="flex w-full items-center gap-3">
        <MessageCircle size={18} strokeWidth={1.6} className="text-neutral-400" />
        <span className="flex-1 text-[14.5px] text-ink">Canal de contacto</span>
        {cliente.canal ? (
          <span className="flex items-center gap-1.5 rounded-lg bg-[#F4ECDB] px-2.5 py-1.5">
            <span className="text-[12.5px] font-semibold text-[#9A7327]">{LABELS.canal[cliente.canal]}</span>
          </span>
        ) : (
          <span className="text-[13.5px] text-muted">Sin definir</span>
        )}
      </div>

      {/* Fuente de contacto (JUA-38): cómo llegó el cliente (origen específico) */}
      <div className="my-4 h-px w-full bg-neutral-100" />
      <div className="flex w-full items-center gap-3">
        <MapPin size={18} strokeWidth={1.6} className="text-neutral-400" />
        <span className="flex-1 text-[14.5px] text-ink">Fuente de contacto</span>
        {cliente.fuenteTipo ? (
          <span className="flex min-w-0 items-center gap-1.5 rounded-lg bg-[#EDE6F3] px-2.5 py-1.5">
            <span className="flex-shrink-0 text-[12.5px] font-semibold text-[#6B4E8F]">
              {LABELS.fuenteContacto[cliente.fuenteTipo]}
            </span>
            {cliente.fuenteDetalle && (
              <span className="truncate text-[12.5px] text-[#6B4E8F]/80">· {cliente.fuenteDetalle}</span>
            )}
          </span>
        ) : (
          <span className="text-[13.5px] text-muted">Sin definir</span>
        )}
      </div>

      {/* Responsable de la cartera (JUA-43) */}
      <div className="my-4 h-px w-full bg-neutral-100" />
      <SelectorResponsableCliente clienteId={cliente._id} responsable={cliente.responsable} />

      {/* Etiquetas de producto (JUA-36) */}
      <div className="my-4 h-px w-full bg-neutral-100" />
      <SelectorEtiquetasCliente clienteId={cliente._id} asignadas={cliente.etiquetas} />
    </div>
  );
}

function FilaContacto({
  icono,
  valor,
  accion,
  className,
}: {
  icono: React.ReactNode;
  valor: React.ReactNode;
  accion: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full items-center gap-3", className)}>
      {icono}
      <span className="min-w-0 flex-1 text-[14.5px] font-medium text-ink">{valor}</span>
      {accion}
    </div>
  );
}

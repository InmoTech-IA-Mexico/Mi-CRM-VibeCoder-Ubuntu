import { LABELS, type Prioridad } from "@/lib/enums";
import { cn } from "@/lib/utils";

// Fuente única de estilos de prioridad de cliente (handoff de diseño), compartida
// por ficha, lista y filtros para evitar deriva. El nivel nunca se comunica solo
// por color: siempre punto + texto. `fondo` es el relleno del badge tipo pill.
export const PRIORIDAD_ESTILO: Record<Prioridad, { punto: string; texto: string; borde: string; fondo: string }> = {
  alta: { punto: "bg-[#B0573F]", texto: "text-[#8A3F2C]", borde: "border-l-[#B0573F]", fondo: "bg-[#F6E7E0]" },
  media: { punto: "bg-[#C9A25E]", texto: "text-[#9A7327]", borde: "border-l-[#C9A25E]", fondo: "bg-[#F4ECDB]" },
  baja: { punto: "bg-[#80847B]", texto: "text-[#6B7268]", borde: "border-l-[#CFC6B2]", fondo: "bg-[#EAEFE8]" },
};

/** Clase del `border-left` de una tarjeta según su prioridad. */
export function bordePrioridadClase(prioridad: Prioridad | null | undefined): string {
  return prioridad ? PRIORIDAD_ESTILO[prioridad].borde : "border-l-neutral-300";
}

/** Indicador compacto (punto + etiqueta) sin fondo. */
export function IndicadorPrioridad({
  prioridad,
  className,
}: {
  prioridad: Prioridad;
  className?: string;
}) {
  const c = PRIORIDAD_ESTILO[prioridad];
  return (
    <span className={cn("flex items-center gap-1", className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", c.punto)} />
      <span className={cn("text-[11.5px] font-semibold", c.texto)}>{LABELS.prioridad[prioridad]}</span>
    </span>
  );
}

/** Badge tipo pill (fondo + punto + etiqueta), para lista y ficha. */
export function BadgePrioridad({ prioridad, className }: { prioridad: Prioridad; className?: string }) {
  const c = PRIORIDAD_ESTILO[prioridad];
  return (
    <span className={cn("flex items-center gap-1.5 rounded-lg px-2 py-0.5", c.fondo, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", c.punto)} />
      <span className={cn("text-[11px] font-semibold", c.texto)}>{LABELS.prioridad[prioridad]}</span>
    </span>
  );
}

import { LABELS, type Prioridad } from "@/lib/enums";
import { cn } from "@/lib/utils";

// Colores de prioridad (handoff de diseño). El estado nunca se comunica solo
// por color: siempre punto + texto.
const COLOR: Record<Prioridad, { punto: string; texto: string; borde: string }> = {
  alta: { punto: "bg-[#B0573F]", texto: "text-[#8A3F2C]", borde: "border-l-[#B0573F]" },
  media: { punto: "bg-[#C9A25E]", texto: "text-[#9A7327]", borde: "border-l-[#C9A25E]" },
  baja: { punto: "bg-[#80847B]", texto: "text-[#6B7268]", borde: "border-l-[#CFC6B2]" },
};

/** Clase del `border-left` de una tarjeta según su prioridad. */
export function bordePrioridadClase(prioridad: Prioridad | null | undefined): string {
  return prioridad ? COLOR[prioridad].borde : "border-l-neutral-300";
}

export function IndicadorPrioridad({
  prioridad,
  className,
}: {
  prioridad: Prioridad;
  className?: string;
}) {
  const c = COLOR[prioridad];
  return (
    <span className={cn("flex items-center gap-1", className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", c.punto)} />
      <span className={cn("text-[11.5px] font-semibold", c.texto)}>
        {LABELS.prioridad[prioridad]}
      </span>
    </span>
  );
}

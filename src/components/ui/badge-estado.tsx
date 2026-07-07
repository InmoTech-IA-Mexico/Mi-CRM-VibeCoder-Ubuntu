import { LABELS, type EstadoCliente } from "@/lib/enums";
import { cn } from "@/lib/utils";

// Badge de estado del cliente (punto + texto), tintado según el estado.
const ESTILO: Record<EstadoCliente, { fondo: string; punto: string; texto: string }> = {
  nuevo: { fondo: "bg-[#F4ECDB]", punto: "bg-[#B68E45]", texto: "text-[#9A7327]" },
  prospecto: { fondo: "bg-[#E2EDEE]", punto: "bg-[#2E6E78]", texto: "text-[#1C4E55]" },
  activo: { fondo: "bg-[#E2EFEB]", punto: "bg-[#2E7D6B]", texto: "text-[#1B5446]" },
  inactivo: { fondo: "bg-[#F0ECE2]", punto: "bg-[#80847B]", texto: "text-[#6B7268]" },
  descartado: { fondo: "bg-[#F1E7E3]", punto: "bg-[#B0573F]", texto: "text-[#8A3F2C]" },
};

export function BadgeEstado({ estado }: { estado: EstadoCliente }) {
  const e = ESTILO[estado];
  return (
    <span className={cn("flex flex-shrink-0 items-center gap-1 rounded-lg px-2.5 py-1", e.fondo)}>
      <span className={cn("h-[5px] w-[5px] rounded-full", e.punto)} />
      <span className={cn("text-[11px] font-semibold", e.texto)}>
        {LABELS.estadoCliente[estado]}
      </span>
    </span>
  );
}

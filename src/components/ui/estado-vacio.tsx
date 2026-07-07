import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Tarjeta de estado vacío (icono + título + subtítulo), centrada. */
export function EstadoVacio({
  icono,
  titulo,
  subtitulo,
  tono = "neutral",
}: {
  icono: ReactNode;
  titulo: string;
  subtitulo?: string;
  tono?: "neutral" | "exito";
}) {
  return (
    <div className="flex flex-col items-center rounded-card border border-neutral-100 bg-surface px-6 py-8 text-center shadow-sm">
      <div
        className={cn(
          "mb-3.5 flex h-16 w-16 items-center justify-center rounded-[18px] border",
          tono === "exito"
            ? "border-teal-tint-border bg-teal-tint"
            : "border-neutral-100 bg-neutral-50",
        )}
      >
        {icono}
      </div>
      <p className="text-[15px] font-semibold text-body">{titulo}</p>
      {subtitulo && (
        <p className="mt-1.5 max-w-[240px] text-[12.5px] leading-snug text-muted">
          {subtitulo}
        </p>
      )}
    </div>
  );
}

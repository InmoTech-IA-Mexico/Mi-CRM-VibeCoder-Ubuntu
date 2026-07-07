"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

/** Hoja inferior (bottom sheet) genérica, sin dependencias externas. */
export function HojaInferior({
  abierta,
  onCerrar,
  titulo,
  children,
}: {
  abierta: boolean;
  onCerrar: () => void;
  titulo?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!abierta) return;
    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", cerrarConEscape);
    return () => window.removeEventListener("keydown", cerrarConEscape);
  }, [abierta, onCerrar]);

  if (!abierta) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]"
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[430px]">
        <div
          role="dialog"
          aria-modal="true"
          className="rounded-t-[24px] border-t border-neutral-100 bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_30px_rgba(14,46,52,0.16)]"
        >
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-neutral-300" />
          {titulo && <div className="mb-2 px-1">{titulo}</div>}
          {children}
        </div>
      </div>
    </div>
  );
}

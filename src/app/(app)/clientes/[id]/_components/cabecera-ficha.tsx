"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { ChevronLeft, Pencil, MoreVertical, Check, Trash2 } from "lucide-react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { HojaConfirmar } from "@/components/ui/hoja-confirmar";
import { LABELS, type EstadoCliente } from "@/lib/enums";
import { cn } from "@/lib/utils";

// Estados que se pueden fijar a mano desde la ficha (JUA-13). `nuevo`/`inactivo`
// son automáticos y no aparecen aquí.
const ESTADOS_MANUALES: Exclude<EstadoCliente, "nuevo" | "inactivo">[] = [
  "prospecto",
  "activo",
  "descartado",
];

export function CabeceraFicha({
  clienteId,
  nombre,
  estado,
  esAdmin,
  token,
}: {
  clienteId: Id<"clientes">;
  nombre: string;
  estado: EstadoCliente;
  esAdmin: boolean;
  token: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [confirmarPapelera, setConfirmarPapelera] = useState(false);
  const [errorPapelera, setErrorPapelera] = useState<string | null>(null);
  const cambiarEstado = useMutation(api.clientes.cambiarEstado);
  const enviarAPapelera = useMutation(api.clientes.enviarAPapelera);

  const onEstado = async (nuevo: (typeof ESTADOS_MANUALES)[number]) => {
    if (ocupado || nuevo === estado) return setAbierto(false);
    setOcupado(true);
    try {
      await cambiarEstado({ token, clienteId, estado: nuevo });
      setAbierto(false);
    } catch (error) {
      console.error("No se pudo cambiar el estado", error);
    } finally {
      setOcupado(false);
    }
  };

  const pedirPapelera = () => {
    setAbierto(false);
    setErrorPapelera(null);
    setConfirmarPapelera(true);
  };

  const hacerPapelera = async () => {
    if (ocupado) return;
    setOcupado(true);
    setErrorPapelera(null);
    try {
      await enviarAPapelera({ token, clienteId });
      router.replace("/clientes");
    } catch (error) {
      console.error("No se pudo enviar a la papelera", error);
      setErrorPapelera("No se pudo enviar a la papelera.");
      setOcupado(false);
    }
  };

  const botonCuadrado =
    "flex h-11 w-11 items-center justify-center rounded-xl border border-border-input bg-surface shadow-sm active:scale-95";

  return (
    <header className="relative flex h-14 items-center justify-between px-3.5">
      <button
        type="button"
        aria-label="Volver"
        onClick={() => router.push("/clientes")}
        className={botonCuadrado}
      >
        <ChevronLeft size={20} strokeWidth={2} className="text-ink" />
      </button>

      <h1 className="absolute left-1/2 max-w-[55%] -translate-x-1/2 truncate text-center font-serif text-lg font-semibold text-ink">
        {nombre}
      </h1>

      <div className="flex gap-2">
        <Link href={`/clientes/${clienteId}/editar`} aria-label="Editar cliente" className={botonCuadrado}>
          <Pencil size={17} strokeWidth={1.7} className="text-ink" />
        </Link>
        <button
          type="button"
          aria-label="Más acciones"
          aria-expanded={abierto}
          onClick={() => setAbierto((v) => !v)}
          className={botonCuadrado}
        >
          <MoreVertical size={18} strokeWidth={2} className="text-ink" />
        </button>
      </div>

      {abierto && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setAbierto(false)}
          />
          <div className="absolute right-3.5 top-[52px] z-50 w-60 overflow-hidden rounded-2xl border border-neutral-100 bg-surface py-1.5 shadow-xl">
            <p className="px-4 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Cambiar estado
            </p>
            {ESTADOS_MANUALES.map((e) => (
              <button
                key={e}
                type="button"
                disabled={ocupado}
                onClick={() => onEstado(e)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[14px] text-ink active:bg-neutral-50 disabled:opacity-60"
              >
                {LABELS.estadoCliente[e]}
                {e === estado && <Check size={16} strokeWidth={2.2} className="text-gold-700" />}
              </button>
            ))}
            {esAdmin && (
              <>
                <div className="my-1.5 h-px bg-neutral-100" />
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={pedirPapelera}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[14px] font-medium text-danger active:bg-neutral-50 disabled:opacity-60",
                  )}
                >
                  <Trash2 size={16} strokeWidth={1.9} />
                  Enviar a papelera
                </button>
              </>
            )}
          </div>
        </>
      )}

      <HojaConfirmar
        abierta={confirmarPapelera}
        titulo="Enviar a la papelera"
        mensaje={`${nombre} se moverá a la papelera. Podrás restaurarlo antes de 30 días.`}
        textoConfirmar="Enviar a papelera"
        tono="danger"
        ocupado={ocupado}
        error={errorPapelera}
        onConfirmar={hacerPapelera}
        onCerrar={() => setConfirmarPapelera(false)}
      />
    </header>
  );
}

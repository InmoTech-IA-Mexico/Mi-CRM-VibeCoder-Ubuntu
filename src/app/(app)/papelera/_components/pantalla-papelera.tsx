"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ChevronLeft, RotateCcw, Trash2, AlertTriangle, AlertCircle } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { useSesion } from "@/components/session/use-sesion";

type ItemPapelera = FunctionReturnType<typeof api.clientes.papelera>[number];

// null = sin modal; {uno} = borrar un cliente; {todo} = vaciar toda la papelera.
type Confirmacion = { tipo: "uno"; item: ItemPapelera } | { tipo: "todo" } | null;

export function PantallaPapelera() {
  const router = useRouter();
  const { token, rol } = useSesion();
  const esAdmin = rol === "admin";

  const items = useQuery(api.clientes.papelera, esAdmin ? { token } : "skip");
  const restaurar = useMutation(api.clientes.restaurar);
  const eliminarDefinitivo = useMutation(api.clientes.eliminarDefinitivo);
  const vaciarPapelera = useMutation(api.clientes.vaciarPapelera);

  const [confirmacion, setConfirmacion] = useState<Confirmacion>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const abrirModal = (c: Confirmacion) => {
    setAviso(null);
    setConfirmacion(c);
  };

  const onRestaurar = async (item: ItemPapelera) => {
    setAviso(null);
    try {
      await restaurar({ token, clienteId: item._id });
    } catch (error) {
      console.error("No se pudo restaurar", error);
      setAviso("No se pudo restaurar el cliente. Inténtalo de nuevo.");
    }
  };

  const onConfirmar = async () => {
    if (!confirmacion || ocupado) return;
    setOcupado(true);
    setAviso(null);
    try {
      if (confirmacion.tipo === "uno") {
        await eliminarDefinitivo({ token, clienteId: confirmacion.item._id });
      } else {
        await vaciarPapelera({ token });
      }
      setConfirmacion(null);
    } catch (error) {
      console.error("No se pudo eliminar", error);
      setAviso("No se pudo completar el borrado. Inténtalo de nuevo.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <header className="relative flex h-14 items-center justify-between px-4">
        <button
          type="button"
          aria-label="Volver"
          onClick={() => router.back()}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-input bg-surface shadow-sm active:scale-95"
        >
          <ChevronLeft size={20} strokeWidth={2} className="text-ink" />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 font-serif text-[22px] font-semibold text-ink">
          Papelera
        </h1>
        {esAdmin && items && items.length > 0 ? (
          <button
            type="button"
            onClick={() => abrirModal({ tipo: "todo" })}
            className="px-1 py-2 text-[14px] font-semibold text-danger active:opacity-70"
          >
            Vaciar todo
          </button>
        ) : (
          <span className="w-11" />
        )}
      </header>

      <p className="px-[18px] pb-4 pt-0.5 text-[13px] leading-snug text-muted">
        Los clientes en papelera no aparecen en tu CRM
      </p>

      {aviso && !confirmacion && (
        <div className="mx-4 mb-3 flex items-center gap-2.5 rounded-2xl border border-danger/30 bg-[#F9ECE7] p-3.5">
          <AlertCircle size={18} strokeWidth={1.9} className="flex-shrink-0 text-danger" />
          <p className="text-[13px] font-medium text-[#8A3F2C]">{aviso}</p>
        </div>
      )}

      {!esAdmin ? (
        <NoAutorizado />
      ) : items === undefined ? (
        <Esqueleto />
      ) : items.length === 0 ? (
        <Vacia />
      ) : (
        <div className="flex flex-col gap-3 px-4 pb-10">
          {items.map((item) => (
            <TarjetaEliminado
              key={item._id}
              item={item}
              onRestaurar={() => onRestaurar(item)}
              onEliminar={() => abrirModal({ tipo: "uno", item })}
            />
          ))}
        </div>
      )}

      {confirmacion && (
        <ModalConfirmar
          titulo={
            confirmacion.tipo === "uno"
              ? `¿Eliminar a ${confirmacion.item.nombre}?`
              : "¿Vaciar toda la papelera?"
          }
          aviso={aviso}
          ocupado={ocupado}
          onCancelar={() => {
            setAviso(null);
            setConfirmacion(null);
          }}
          onConfirmar={onConfirmar}
        />
      )}
    </div>
  );
}

function TarjetaEliminado({
  item,
  onRestaurar,
  onEliminar,
}: {
  item: ItemPapelera;
  onRestaurar: () => void;
  onEliminar: () => void;
}) {
  const inicial = item.nombre.trim().charAt(0).toUpperCase() || "?";
  const dias = item.diasEliminado;
  const eliminado = dias === 0 ? "Eliminado hoy" : `Eliminado hace ${dias} ${dias === 1 ? "día" : "días"}`;
  const restantes = `quedan ${item.diasRestantes} ${item.diasRestantes === 1 ? "día" : "días"}`;

  return (
    <div className="rounded-[18px] border border-neutral-100 bg-[#FCFAF4] p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 opacity-70">
          <span className="text-[15px] font-semibold text-[#6B7268]">{inicial}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-body">{item.nombre}</p>
          {item.empresa && <p className="mt-0.5 truncate text-[12.5px] text-muted">{item.empresa}</p>}
        </div>
      </div>

      <p className="mt-3 text-[12.5px] text-muted">
        {eliminado} · <span className="text-gold-700">{restantes}</span>
      </p>

      <div className="mt-3.5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onRestaurar}
          className="flex h-8 items-center gap-1.5 rounded-full border border-[#C9DDDF] bg-[#E2EDEE] px-3.5 text-[13px] font-semibold text-[#1C4E55] active:scale-95"
        >
          <RotateCcw size={13} strokeWidth={2} />
          Restaurar
        </button>
        <button
          type="button"
          onClick={onEliminar}
          className="flex h-8 items-center gap-1.5 rounded-full border border-danger/30 bg-[#F6E7E0] px-3.5 text-[13px] font-semibold text-[#8A3F2C] active:scale-95"
        >
          <Trash2 size={13} strokeWidth={2} />
          Eliminar
        </button>
      </div>
    </div>
  );
}

function ModalConfirmar({
  titulo,
  aviso,
  ocupado,
  onCancelar,
  onConfirmar,
}: {
  titulo: string;
  aviso: string | null;
  ocupado: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-center justify-center px-6">
      <button
        type="button"
        aria-label="Cancelar"
        onClick={onCancelar}
        className="absolute inset-0 cursor-default bg-[rgba(11,37,42,0.45)]"
      />
      <div className="relative flex w-full max-w-[330px] flex-col items-center rounded-[20px] border border-neutral-100 bg-surface p-6 shadow-2xl">
        <div className="mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-[18px] border border-danger/25 bg-[#F6E7E0]">
          <AlertTriangle size={30} strokeWidth={1.9} className="text-danger" />
        </div>
        <h2 className="text-center font-serif text-[21px] font-semibold text-ink">{titulo}</h2>
        <p className="mt-2.5 text-center text-[14px] leading-relaxed text-body">
          Esta acción no se puede deshacer. Todos sus datos, notas e historial se eliminarán permanentemente.
        </p>
        {aviso && (
          <div className="mt-4 flex w-full items-center gap-2 rounded-xl border border-danger/30 bg-[#F9ECE7] px-3 py-2.5">
            <AlertCircle size={16} strokeWidth={1.9} className="flex-shrink-0 text-danger" />
            <p className="text-[12.5px] font-medium text-[#8A3F2C]">{aviso}</p>
          </div>
        )}
        <div className="my-5 h-px w-full bg-neutral-100" />
        <div className="flex w-full flex-col gap-2.5">
          <button
            type="button"
            onClick={onCancelar}
            disabled={ocupado}
            className="flex h-12 items-center justify-center rounded-xl border border-border-input bg-surface text-[15px] font-semibold text-ink active:scale-[0.99] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={ocupado}
            aria-busy={ocupado}
            className="flex h-12 items-center justify-center rounded-xl bg-danger text-[15px] font-bold text-white shadow-[0_2px_6px_rgba(176,87,63,0.30)] active:scale-[0.99] disabled:opacity-70"
          >
            {ocupado ? "Eliminando…" : "Eliminar para siempre"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Vacia() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-11 pb-24 text-center">
      <div className="mb-6 flex h-[104px] w-[104px] items-center justify-center rounded-[28px] border border-[#E0C795] bg-[#F4ECDB] shadow-sm">
        <Trash2 size={50} strokeWidth={1.5} className="text-gold-500" />
      </div>
      <p className="font-serif text-2xl font-semibold text-ink">La papelera está vacía</p>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">
        Los clientes que elimines aparecerán aquí
      </p>
    </div>
  );
}

function NoAutorizado() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-11 pb-24 text-center">
      <p className="font-serif text-xl font-semibold text-ink">Solo para administradores</p>
      <p className="mt-2 text-[14px] text-muted">La papelera solo está disponible para el administrador del negocio.</p>
    </div>
  );
}

function Esqueleto() {
  return (
    <div className="flex flex-col gap-3 px-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[132px] animate-pulse rounded-[18px] bg-neutral-100" />
      ))}
    </div>
  );
}

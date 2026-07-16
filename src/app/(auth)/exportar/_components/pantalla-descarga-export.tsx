"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { Download, FileText, Check, AlertCircle, ShieldCheck } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";

// Página de descarga de una exportación (JUA-44). Gateada por el token del
// enlace. La consumición (mutación de UN SOLO USO) genera los 4 CSV y los
// devuelve; se descargan en el navegador (nada se almacena en el servidor).

type Archivo = { nombre: string; csv: string };

export function PantallaDescargaExport({ token }: { token: string }) {
  const info = useQuery(api.exportaciones.estado, token ? { token } : "skip");
  const consumir = useMutation(api.exportaciones.consumir);

  const [descargando, setDescargando] = useState(false);
  const [archivos, setArchivos] = useState<Archivo[] | null>(null);
  const [descargados, setDescargados] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const descargarArchivo = (a: Archivo) => {
    const blob = new Blob([a.csv], { type: "text/csv;charset=utf-8" });
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(blob);
    enlace.download = a.nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(enlace.href);
    setDescargados((prev) => new Set(prev).add(a.nombre));
  };

  const generarYDescargar = async () => {
    if (descargando) return;
    setDescargando(true);
    setError(null);
    try {
      const res = await consumir({ token });
      setArchivos(res.archivos);
      // Descarga los 4 automáticamente; los botones quedan como respaldo.
      res.archivos.forEach((a, i) => setTimeout(() => descargarArchivo(a), i * 300));
    } catch (e) {
      const msg = e instanceof Error ? e.message.replace(/^\[.*?\]\s*/, "") : "";
      console.error("No se pudo generar la descarga", e);
      setError(msg && !/Uncaught|Server Error/.test(msg) ? msg : "No se pudo generar la descarga. Inténtalo de nuevo.");
    } finally {
      setDescargando(false);
    }
  };

  // Si ya consumimos el enlace en esta sesión, la vista de archivos MANDA sobre
  // la query reactiva (que ya reporta "usada"): así los botones de respaldo no
  // desaparecen si el navegador bloqueó la descarga automática.
  if (!archivos) {
    if (!token) return <Mensaje titulo="Enlace no válido" texto="Falta el código de descarga en el enlace." />;
    if (info === undefined) return <p className="text-center text-[14px] text-muted">Cargando…</p>;
    if (info.estado === "invalida")
      return <Mensaje titulo="Enlace no válido" texto="Este enlace de descarga no existe." />;
    if (info.estado === "usada")
      return <Mensaje titulo="Enlace ya utilizado" texto="Esta exportación ya se descargó. Genera una nueva desde el CRM si la necesitas." />;
    if (info.estado === "expirada")
      return <Mensaje titulo="Este enlace ha expirado" texto="Las exportaciones son válidas 24 horas. Genera una nueva desde el CRM." />;
  }
  const negocioNombre = info && info.estado === "valida" ? info.negocioNombre : null;

  return (
    <div className="w-full">
      <header className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#E4F0EC] text-teal-800">
          <Download size={26} strokeWidth={1.8} />
        </div>
        <h1 className="font-serif text-[24px] font-semibold text-ink">Descargar datos</h1>
        <p className="mt-1.5 text-[13.5px] text-muted">
          Exportación de <span className="font-medium text-body">{negocioNombre ?? "tu negocio"}</span>.
        </p>
      </header>

      {!archivos ? (
        <>
          <p className="mb-4 flex items-start gap-2 rounded-xl border border-neutral-100 bg-neutral-50/60 px-3.5 py-3 text-[12.5px] leading-snug text-body">
            <ShieldCheck size={15} strokeWidth={1.9} className="mt-0.5 flex-shrink-0 text-teal-800" />
            Este enlace es de un solo uso: al descargar quedará invalidado.
          </p>
          <button
            type="button"
            onClick={() => void generarYDescargar()}
            disabled={descargando}
            aria-busy={descargando}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold-500 text-[15px] font-bold text-ink shadow-[0_2px_8px_rgba(201,162,94,0.32)] transition active:scale-[0.99] disabled:opacity-60"
          >
            <Download size={18} strokeWidth={2} />
            {descargando ? "Generando…" : "Descargar los 4 archivos"}
          </button>
        </>
      ) : (
        <>
          <p className="mb-4 text-center text-[13px] text-body">
            Si la descarga no empezó automáticamente, usa los botones:
          </p>
          <div className="flex flex-col gap-2.5">
            {archivos.map((a) => (
              <button
                key={a.nombre}
                type="button"
                onClick={() => descargarArchivo(a)}
                className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-surface p-3.5 text-left shadow-sm transition active:scale-[0.99]"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-neutral-50">
                  <FileText size={18} strokeWidth={1.8} className="text-teal-800" />
                </div>
                <span className="flex-1 text-[14.5px] font-medium text-ink">{a.nombre}</span>
                {descargados.has(a.nombre) ? (
                  <Check size={18} strokeWidth={2.2} className="text-success" />
                ) : (
                  <Download size={17} strokeWidth={1.9} className="text-neutral-400" />
                )}
              </button>
            ))}
          </div>
          <p className="mt-5 text-center text-[12.5px] text-muted">
            Ya puedes cerrar esta página. El enlace quedó invalidado.
          </p>
        </>
      )}

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-danger/30 bg-[#F9ECE7] px-3 py-2.5">
          <AlertCircle size={16} strokeWidth={1.9} className="flex-shrink-0 text-danger" />
          <p className="text-[12.5px] font-medium text-[#8A3F2C]">{error}</p>
        </div>
      )}
    </div>
  );
}

function Mensaje({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="w-full text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F9ECE7] text-danger">
        <AlertCircle size={28} strokeWidth={1.8} />
      </div>
      <h1 className="font-serif text-[22px] font-semibold text-ink">{titulo}</h1>
      <p className="mx-auto mt-2 max-w-[300px] text-[13.5px] leading-relaxed text-muted">{texto}</p>
      <Link href="/login" className="mt-5 inline-block text-[13.5px] font-medium text-teal-800 underline">
        Ir al CRM
      </Link>
    </div>
  );
}

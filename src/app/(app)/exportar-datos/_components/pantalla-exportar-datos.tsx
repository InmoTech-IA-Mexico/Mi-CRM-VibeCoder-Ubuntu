"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { ChevronLeft, Download, ShieldCheck, Clock, Link2, Check, ExternalLink, AlertCircle } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { useSesion } from "@/components/session/use-sesion";
import { cn } from "@/lib/utils";

// Exportación de datos (JUA-44). Solo admin: genera un enlace temporal (24 h,
// un solo uso) para descargar los 4 CSV del negocio. La entrega es por pantalla
// ("Copiar enlace", como las invitaciones) mientras no haya email real (Resend).

export function PantallaExportarDatos() {
  const router = useRouter();
  const { token, rol } = useSesion();
  const esAdmin = rol === "admin";
  const solicitar = useMutation(api.exportaciones.solicitar);

  const [generando, setGenerando] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!esAdmin) router.replace("/inicio");
  }, [esAdmin, router]);
  if (!esAdmin) return null;

  const generar = async () => {
    if (generando) return;
    setGenerando(true);
    setError(null);
    setCopiado(false);
    try {
      const res = await solicitar({ token });
      setUrl(`${window.location.origin}/exportar?token=${res.token}`);
    } catch (e) {
      console.error("No se pudo generar la exportación", e);
      setError("No se pudo generar la exportación. Inténtalo de nuevo.");
    } finally {
      setGenerando(false);
    }
  };

  const copiar = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
    } catch {
      setError("No se pudo copiar. Enlace: " + url);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="relative flex h-14 items-center justify-between px-4">
        <button
          type="button"
          aria-label="Volver"
          onClick={() => router.back()}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-input bg-surface shadow-sm active:scale-95"
        >
          <ChevronLeft size={20} strokeWidth={2} className="text-ink" />
        </button>
        <h1 className="font-serif text-xl font-semibold text-ink">Exportar datos</h1>
        <div className="h-11 w-11" aria-hidden />
      </header>

      <div className="flex flex-col gap-4 px-4 pt-2 pb-10">
        <p className="px-1 text-[13px] leading-snug text-body">
          Descarga todos los datos del negocio en 4 archivos CSV: clientes (incluida la papelera),
          notas, oportunidades y recordatorios.
        </p>

        {/* Nota de seguridad */}
        <div className="flex items-start gap-2.5 rounded-2xl border border-neutral-100 bg-neutral-50/60 p-3.5">
          <ShieldCheck size={18} strokeWidth={1.8} className="mt-0.5 flex-shrink-0 text-teal-800" />
          <div className="text-[12.5px] leading-snug text-body">
            <p>Se genera un <span className="font-semibold text-ink">enlace privado y temporal</span>:</p>
            <ul className="mt-1.5 flex flex-col gap-1">
              <li className="flex items-center gap-1.5"><Clock size={12} strokeWidth={2} className="flex-shrink-0 text-muted" /> Válido 24 horas y de un solo uso.</li>
              <li className="flex items-center gap-1.5"><ShieldCheck size={12} strokeWidth={2} className="flex-shrink-0 text-muted" /> Solo tú (administradora) puedes generarlo.</li>
            </ul>
          </div>
        </div>

        {!url ? (
          <button
            type="button"
            onClick={() => void generar()}
            disabled={generando}
            aria-busy={generando}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold-500 text-[15px] font-bold text-ink shadow-[0_2px_8px_rgba(201,162,94,0.32)] transition active:scale-[0.99] disabled:opacity-60"
          >
            <Download size={18} strokeWidth={2} />
            {generando ? "Generando…" : "Generar exportación"}
          </button>
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl border border-teal-800/20 bg-[#E4F0EC]/50 p-4">
            <div className="flex items-center gap-2 text-[13.5px] font-semibold text-teal-800">
              <Check size={17} strokeWidth={2.4} />
              Enlace de descarga listo
            </div>
            <p className="text-[12.5px] leading-snug text-body">
              Ábrelo para descargar los archivos. Al usarlo, el enlace queda invalidado; si lo
              necesitas de nuevo, genera otra exportación.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void copiar()}
                className={cn(
                  "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13.5px] font-semibold transition active:scale-[0.99]",
                  copiado ? "border border-teal-800/30 bg-surface text-teal-800" : "bg-surface border border-border-input text-ink",
                )}
              >
                {copiado ? <Check size={15} strokeWidth={2.4} /> : <Link2 size={15} strokeWidth={2} />}
                {copiado ? "Copiado" : "Copiar enlace"}
              </button>
              <Link
                href={url.replace(window.location.origin, "")}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-gold-500 text-[13.5px] font-bold text-ink shadow-[0_2px_6px_rgba(201,162,94,0.32)] active:scale-[0.99]"
              >
                <ExternalLink size={15} strokeWidth={2} />
                Abrir descarga
              </Link>
            </div>
            <button
              type="button"
              onClick={() => void generar()}
              disabled={generando}
              className="text-[12.5px] font-medium text-teal-800 underline-offset-2 active:underline disabled:opacity-60"
            >
              Generar un enlace nuevo
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-[#F9ECE7] px-3 py-2.5">
            <AlertCircle size={16} strokeWidth={1.9} className="flex-shrink-0 text-danger" />
            <p className="text-[12.5px] font-medium text-[#8A3F2C]">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

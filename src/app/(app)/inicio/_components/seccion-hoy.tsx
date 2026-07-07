import { CalendarCheck } from "lucide-react";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { EsqueletoLista } from "@/components/ui/esqueleto-lista";
import { TarjetaRecordatorio, type ItemAgenda } from "./tarjeta-recordatorio";

export function SeccionHoy({ items }: { items: ItemAgenda[] | undefined }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-serif text-lg font-semibold text-ink">Hoy</h2>
        {items && items.length > 0 && (
          <span className="text-xs font-semibold uppercase tracking-wide text-gold-text">
            {items.length} {items.length === 1 ? "pendiente" : "pendientes"}
          </span>
        )}
      </div>

      {items === undefined ? (
        <EsqueletoLista />
      ) : items.length === 0 ? (
        <EstadoVacio
          icono={<CalendarCheck size={30} strokeWidth={1.6} className="text-neutral-400" />}
          titulo="No tienes pendientes para hoy"
          subtitulo="Disfruta tu día"
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((it) => (
            <TarjetaRecordatorio key={it._id} item={it} />
          ))}
        </div>
      )}
    </section>
  );
}

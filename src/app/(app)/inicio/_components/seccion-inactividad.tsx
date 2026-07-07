import { ShieldCheck } from "lucide-react";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { EsqueletoLista } from "@/components/ui/esqueleto-lista";
import { TarjetaClienteInactivo, type ItemInactividad } from "./tarjeta-cliente-inactivo";

export function SeccionInactividad({ items }: { items: ItemInactividad[] | undefined }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-serif text-lg font-semibold text-ink">Requieren atención</h2>
        {items && items.length > 0 && (
          <span className="text-xs font-semibold uppercase tracking-wide text-danger">
            {items.length} {items.length === 1 ? "cliente" : "clientes"}
          </span>
        )}
      </div>

      {items === undefined ? (
        <EsqueletoLista />
      ) : items.length === 0 ? (
        <EstadoVacio
          tono="exito"
          icono={<ShieldCheck size={32} strokeWidth={1.6} className="text-success" />}
          titulo="Todos tus clientes al día"
          subtitulo="Ningún cliente lleva más de 15 días sin contacto"
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((it, i) => (
            <TarjetaClienteInactivo key={it._id} item={it} indice={i} />
          ))}
        </div>
      )}
    </section>
  );
}

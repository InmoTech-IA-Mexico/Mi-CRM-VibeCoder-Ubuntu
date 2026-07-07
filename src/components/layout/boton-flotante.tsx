import Link from "next/link";
import { Plus } from "lucide-react";

// FAB "+" para dar de alta un cliente, flotando sobre la barra inferior en la
// esquina del marco (queda alineado al contenedor centrado de 430px).
export function BotonFlotante() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px]">
      <Link
        href="/clientes/nuevo"
        aria-label="Nuevo cliente"
        className="pointer-events-auto absolute bottom-[calc(84px+env(safe-area-inset-bottom))] right-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-gold-500 to-gold-600 text-white shadow-[0_8px_20px_rgba(201,162,94,0.45)] transition-transform active:scale-95"
      >
        <Plus size={26} strokeWidth={2.4} />
      </Link>
    </div>
  );
}

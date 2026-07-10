"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

// Aviso global de "sin conexión" (JUA-31). Se muestra cuando el dispositivo pierde
// la red. Las pantallas ya cargadas siguen siendo legibles; al intentar guardar sin
// conexión la mutación falla y la propia pantalla muestra su error (no se pierde el
// contenido escrito). Arranca asumiendo "en línea" para no parpadear en SSR.
export function BannerSinConexion() {
  const [enLinea, setEnLinea] = useState(true);

  useEffect(() => {
    const actualizar = () => setEnLinea(navigator.onLine);
    actualizar();
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);
    return () => {
      window.removeEventListener("online", actualizar);
      window.removeEventListener("offline", actualizar);
    };
  }, []);

  if (enLinea) return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-[#8A3F2C] px-4 py-2 text-white shadow-sm"
    >
      <WifiOff size={15} strokeWidth={2} className="flex-shrink-0" />
      <p className="text-[12.5px] font-medium">
        Sin conexión. Los cambios no se guardarán hasta que vuelvas a estar en línea.
      </p>
    </div>
  );
}

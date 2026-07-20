import type { Metadata } from "next";
import { PantallaRegistro } from "./_components/pantalla-registro";

// Registro público autoservicio de nuevos negocios (JUA-39). Ruta pública sin sesión.
// `noindex` (control 6 del dictamen): no debe aparecer en buscadores.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function Page() {
  return <PantallaRegistro />;
}

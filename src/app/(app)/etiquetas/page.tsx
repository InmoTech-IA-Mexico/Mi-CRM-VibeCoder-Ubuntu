import { PantallaEtiquetas } from "./_components/pantalla-etiquetas";

// Gestión de etiquetas de producto (JUA-36). Solo admin. Sin diseño en el
// handoff: sigue los patrones de Gestión de usuarios (header, tarjetas, hojas).
export default function Page() {
  return <PantallaEtiquetas />;
}

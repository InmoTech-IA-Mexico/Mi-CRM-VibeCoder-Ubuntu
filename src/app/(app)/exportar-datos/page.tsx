import { PantallaExportarDatos } from "./_components/pantalla-exportar-datos";

// Exportación de datos en autoservicio (JUA-44). Solo admin. Genera un enlace
// temporal de descarga (24 h, un solo uso). Sin diseño en el handoff: sigue los
// patrones de Gestión de usuarios / Etiquetas.
export default function Page() {
  return <PantallaExportarDatos />;
}

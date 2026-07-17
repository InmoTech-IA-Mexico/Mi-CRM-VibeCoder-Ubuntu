import { PantallaRegistro } from "./_components/pantalla-registro";

// Registro público autoservicio de nuevos negocios (JUA-39). Ruta pública (grupo
// (auth), sin nav). El alta crea el negocio + su admin y entra directo al CRM.
export default function Page() {
  return <PantallaRegistro />;
}

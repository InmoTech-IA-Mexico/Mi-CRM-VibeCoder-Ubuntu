import { PantallaClientes } from "./_components/pantalla-clientes";

// Lista de clientes + buscador en tiempo real (JUA-14). Acepta `?estado=` para
// filtrar desde el dashboard de estado global (JUA-35), leído en el servidor.
// Diseño: design/design_handoff_inmotech_crm/Lista Clientes.dc.html
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  // `key` por estado: si cambia el query param, remonta y re-sincroniza el filtro.
  return <PantallaClientes key={estado ?? "todos"} estadoInicial={estado} />;
}

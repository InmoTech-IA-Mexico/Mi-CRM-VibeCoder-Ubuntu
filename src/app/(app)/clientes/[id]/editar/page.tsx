import type { Id } from "../../../../../../convex/_generated/dataModel";
import { PantallaEditarCliente } from "./_components/pantalla-editar-cliente";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PantallaEditarCliente clienteId={id as Id<"clientes">} />;
}

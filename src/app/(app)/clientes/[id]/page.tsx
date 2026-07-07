import type { Id } from "../../../../../convex/_generated/dataModel";
import { PantallaFichaCliente } from "./_components/pantalla-ficha-cliente";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PantallaFichaCliente clienteId={id as Id<"clientes">} />;
}

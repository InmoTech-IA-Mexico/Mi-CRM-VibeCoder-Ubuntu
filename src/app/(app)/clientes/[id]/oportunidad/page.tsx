import type { Id } from "../../../../../../convex/_generated/dataModel";
import { PantallaNuevaOportunidad } from "./_components/pantalla-nueva-oportunidad";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PantallaNuevaOportunidad clienteId={id as Id<"clientes">} />;
}

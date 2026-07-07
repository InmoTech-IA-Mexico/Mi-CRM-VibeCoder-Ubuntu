import type { Id } from "../../../../../../convex/_generated/dataModel";
import { PantallaNuevoRecordatorio } from "./_components/pantalla-nuevo-recordatorio";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PantallaNuevoRecordatorio clienteId={id as Id<"clientes">} />;
}

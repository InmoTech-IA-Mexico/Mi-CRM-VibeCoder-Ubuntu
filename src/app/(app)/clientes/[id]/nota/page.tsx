import type { Id } from "../../../../../../convex/_generated/dataModel";
import { PantallaNuevaNota } from "./_components/pantalla-nueva-nota";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PantallaNuevaNota clienteId={id as Id<"clientes">} />;
}

import { ScreenPlaceholder } from "@/components/screen-placeholder";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ScreenPlaceholder title="Editar cliente" design="Editar Cliente.dc.html" issue="JUA-67">
      Cliente #{id} — pantalla por construir.
    </ScreenPlaceholder>
  );
}

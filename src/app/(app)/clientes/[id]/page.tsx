import { ScreenPlaceholder } from "@/components/screen-placeholder";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ScreenPlaceholder title="Ficha de cliente" design="Ficha Cliente.dc.html" issue="JUA-13">
      Cliente #{id} — pantalla por construir.
    </ScreenPlaceholder>
  );
}

import { ScreenPlaceholder } from "@/components/screen-placeholder";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ScreenPlaceholder title="Nuevo recordatorio" design="Nota Recordatorio Form.dc.html" issue="JUA-22">
      Cliente #{id} — pantalla por construir.
    </ScreenPlaceholder>
  );
}

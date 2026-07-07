import { ScreenPlaceholder } from "@/components/screen-placeholder";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ScreenPlaceholder title="Nueva nota" design="Nota Recordatorio Form.dc.html" issue="JUA-17">
      Cliente #{id} — pantalla por construir.
    </ScreenPlaceholder>
  );
}

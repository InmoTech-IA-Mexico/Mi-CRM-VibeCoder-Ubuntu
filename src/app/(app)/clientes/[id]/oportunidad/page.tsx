import { ScreenPlaceholder } from "@/components/screen-placeholder";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ScreenPlaceholder title="Oportunidad" design="Oportunidad Form.dc.html" issue="JUA-20 / JUA-21">
      Cliente #{id} — pantalla por construir.
    </ScreenPlaceholder>
  );
}

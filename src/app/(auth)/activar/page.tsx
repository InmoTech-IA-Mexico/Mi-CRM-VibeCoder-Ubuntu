import { PantallaActivar } from "./_components/pantalla-activar";

// Next 16: searchParams es asíncrono. Leemos el token en el servidor y lo
// pasamos como prop → sin acceso a `window` en el render (evita mismatch de
// hidratación) y SSR-safe.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <PantallaActivar token={token ?? ""} />;
}

import { PantallaDescargaExport } from "./_components/pantalla-descarga-export";

// Descarga de una exportación (JUA-44). Pública, gateada SOLO por el token del
// enlace (sin sesión: la administradora puede abrirlo en cualquier dispositivo).
// Token vía searchParams del server (SSR-safe, sin mismatch de hidratación).
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <PantallaDescargaExport token={token ?? ""} />;
}

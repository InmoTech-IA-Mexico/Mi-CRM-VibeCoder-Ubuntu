import { FormularioLogin } from "./_components/formulario-login";

// Pantalla de Login (JUA-6). Lee los avisos de la URL en el servidor y los pasa
// como props (SSR-safe, sin mismatch de hidratación): sesión expirada
// (?expirada) y contraseña restablecida (?reset, JUA-7).
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ expirada?: string; reset?: string }>;
}) {
  const sp = await searchParams;
  return <FormularioLogin expirada={sp.expirada !== undefined} restablecida={sp.reset !== undefined} />;
}

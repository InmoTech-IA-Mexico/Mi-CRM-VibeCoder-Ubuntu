import { BannerSinConexion } from "@/components/layout/banner-sin-conexion";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-center px-6">
      {/* Aviso sin conexión también en auth: activación/recuperación guardan (JUA-31). */}
      <div className="absolute inset-x-0 top-0">
        <BannerSinConexion />
      </div>
      {children}
    </div>
  );
}

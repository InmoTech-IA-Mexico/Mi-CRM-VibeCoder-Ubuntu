import { MenuPerfil } from "@/components/layout/menu-perfil";

export function EncabezadoInicio({ fecha }: { fecha: string }) {
  return (
    <header className="flex items-center justify-between py-2">
      <div>
        <h1 className="font-serif text-2xl font-semibold leading-none text-ink">
          Inicio
        </h1>
        <p className="mt-1.5 text-[12.5px] text-muted">{fecha}</p>
      </div>
      <MenuPerfil />
    </header>
  );
}

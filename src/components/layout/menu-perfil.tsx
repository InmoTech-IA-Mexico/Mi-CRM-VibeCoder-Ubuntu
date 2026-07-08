"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, LogOut, Trash2, Users, TrendingUp } from "lucide-react";
import { useSesion } from "@/components/session/use-sesion";
import { HojaInferior } from "@/components/ui/hoja-inferior";
import { LABELS } from "@/lib/enums";

// Avatar del header + menú de perfil (bottom sheet). Opciones por rol (JUA-27):
// el operativo solo ve "Cerrar sesión"; el admin ve además "Gestión de usuarios"
// y "Papelera".
const OPCIONES_ADMIN = [
  { label: "Gestión de usuarios", icon: Users, href: "/usuarios" },
  { label: "Papelera", icon: Trash2, href: "/papelera" },
];

export function MenuPerfil() {
  const { usuario, rol, cerrarSesion } = useSesion();
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);

  const inicial = usuario.nombre.charAt(0).toUpperCase();

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        aria-label="Abrir menú de perfil"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#D2B074] to-[#B68E45] shadow-[0_3px_10px_rgba(201,162,94,0.35)]"
      >
        <span className="font-serif text-base font-semibold text-white">{inicial}</span>
      </button>

      <HojaInferior
        abierta={abierta}
        onCerrar={() => setAbierta(false)}
        titulo={
          <div>
            <p className="font-serif text-lg font-semibold text-ink">{usuario.nombre}</p>
            <p className="text-[12.5px] text-muted">
              {usuario.email} · {LABELS.rol[rol]}
            </p>
          </div>
        }
      >
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => {
              setAbierta(false);
              router.push("/ventas");
            }}
            className="flex items-center gap-3 rounded-input px-2 py-3 text-left text-[15px] text-ink active:bg-row-hover"
          >
            <TrendingUp size={19} className="text-body" />
            <span className="flex-1">Ventas</span>
            <ChevronRight size={17} className="text-muted" />
          </button>
          {rol === "admin" &&
            OPCIONES_ADMIN.map(({ label, icon: Icon, href }) => (
              <button
                key={href}
                type="button"
                onClick={() => {
                  setAbierta(false);
                  router.push(href);
                }}
                className="flex items-center gap-3 rounded-input px-2 py-3 text-left text-[15px] text-ink active:bg-row-hover"
              >
                <Icon size={19} className="text-body" />
                <span className="flex-1">{label}</span>
                <ChevronRight size={17} className="text-muted" />
              </button>
            ))}
          <button
            type="button"
            onClick={() => void cerrarSesion()}
            className="flex items-center gap-3 rounded-input px-2 py-3 text-left text-[15px] text-danger active:bg-row-hover"
          >
            <LogOut size={19} />
            <span className="flex-1">Cerrar sesión</span>
          </button>
        </div>
      </HojaInferior>
    </>
  );
}

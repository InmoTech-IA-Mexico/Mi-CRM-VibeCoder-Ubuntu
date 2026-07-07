"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, LogOut, Trash2, Users } from "lucide-react";
import { useSesion } from "@/components/session/use-sesion";
import { HojaInferior } from "@/components/ui/hoja-inferior";
import { LABELS } from "@/lib/enums";
import { cn } from "@/lib/utils";

// Avatar del header + menú de perfil (bottom sheet). Las opciones se diferencian
// por rol (JUA-27): el operativo solo ve "Cerrar sesión"; el admin ve además
// "Gestión de usuarios" y "Papelera".
const OPCIONES_ADMIN = [
  { label: "Gestión de usuarios", icon: Users, href: "/usuarios" },
  { label: "Papelera", icon: Trash2, href: "/papelera" },
];

export function MenuPerfil() {
  const { usuario, rol, usuarios, setUsuarioActivo } = useSesion();
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);

  const inicial = usuario.nombre.charAt(0).toUpperCase();

  const cerrarSesion = () => {
    window.localStorage.removeItem("sesion.usuarioActivoId");
    router.push("/login");
  };

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
            onClick={cerrarSesion}
            className="flex items-center gap-3 rounded-input px-2 py-3 text-left text-[15px] text-danger active:bg-row-hover"
          >
            <LogOut size={19} />
            <span className="flex-1">Cerrar sesión</span>
          </button>
        </div>

        {/* TODO(JUA-6/JUA-30): conmutador de usuario solo para desarrollo. */}
        <div className="mt-2 border-t border-neutral-100 pt-3">
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Cambiar usuario (dev)
          </p>
          <div className="flex flex-wrap gap-2 px-1">
            {usuarios.map((u) => (
              <button
                key={u._id}
                type="button"
                onClick={() => setUsuarioActivo(u._id)}
                className={cn(
                  "rounded-pill border px-3 py-1.5 text-[12.5px] font-medium",
                  u._id === usuario._id
                    ? "border-teal-800 bg-teal-tint text-teal-tint-fg"
                    : "border-neutral-100 text-body",
                )}
              >
                {u.nombre.split(" ")[0]} · {LABELS.rol[u.rol]}
              </button>
            ))}
          </div>
        </div>
      </HojaInferior>
    </>
  );
}

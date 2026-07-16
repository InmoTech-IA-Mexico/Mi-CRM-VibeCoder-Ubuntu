"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useSesion, usePuedeEditar } from "@/components/session/use-sesion";
import { fechaLargaES, rangoDiaEnZona } from "@/lib/fechas";
import { EncabezadoInicio } from "./encabezado-inicio";
import { SeccionHoy } from "./seccion-hoy";
import { SeccionInactividad } from "./seccion-inactividad";

export function PantallaInicio() {
  const { negocio, token } = useSesion();
  const puedeEditar = usePuedeEditar();

  // La hora actual se fija una sola vez al montar. A partir de ella, "hoy" se
  // calcula en la zona horaria del negocio para la ventana de la agenda. El
  // aislamiento por negocio lo garantiza el token en el servidor (JUA-10).
  const [ahora] = useState(() => Date.now());
  const { inicioDia, finDia } = useMemo(
    () => rangoDiaEnZona(negocio.zonaHoraria, ahora),
    [negocio.zonaHoraria, ahora],
  );

  const agenda = useQuery(api.inicio.agendaDelDia, { token, inicioDia, finDia });
  const inactivos = useQuery(api.inicio.panelInactividad, { token });

  // JUA-26: al abrir Inicio, persiste la transición a "Inactivo" de los clientes
  // del negocio que superan los 15 días sin interacción (inmediato; el cron diario
  // es la red de seguridad). Idempotente y sin bloquear el render.
  const sincronizarInactividad = useMutation(api.clientes.sincronizarInactividad);
  useEffect(() => {
    // El observador (solo lectura, JUA-42) no dispara escrituras; el cron diario
    // se encarga de la transición a Inactivo igualmente.
    if (!puedeEditar) return;
    sincronizarInactividad({ token }).catch((e) =>
      console.error("No se pudo sincronizar la inactividad de clientes", e),
    );
  }, [sincronizarInactividad, token, puedeEditar]);

  return (
    <div className="px-4 pt-2">
      <EncabezadoInicio fecha={fechaLargaES(ahora, negocio.zonaHoraria)} />
      <div className="mt-3 flex flex-col gap-6">
        <SeccionHoy items={agenda} />
        <SeccionInactividad items={inactivos} />
      </div>
    </div>
  );
}

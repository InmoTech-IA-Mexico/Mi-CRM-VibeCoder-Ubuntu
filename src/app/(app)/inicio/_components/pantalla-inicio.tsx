"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useSesion } from "@/components/session/use-sesion";
import { fechaLargaES, rangoDiaEnZona } from "@/lib/fechas";
import { EncabezadoInicio } from "./encabezado-inicio";
import { SeccionHoy } from "./seccion-hoy";
import { SeccionInactividad } from "./seccion-inactividad";

export function PantallaInicio() {
  const { negocio } = useSesion();

  // La hora actual se fija una sola vez al montar. A partir de ella, "hoy" se
  // calcula en la zona horaria del negocio y se pasa como arg a las queries
  // (quedan deterministas y reactivas).
  const [ahora] = useState(() => Date.now());
  const { inicioDia, finDia } = useMemo(
    () => rangoDiaEnZona(negocio.zonaHoraria, ahora),
    [negocio.zonaHoraria, ahora],
  );

  const agenda = useQuery(api.inicio.agendaDelDia, {
    negocioId: negocio._id,
    inicioDia,
    finDia,
  });
  const inactivos = useQuery(api.inicio.panelInactividad, {
    negocioId: negocio._id,
    ahora,
  });

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

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { resolverSesion, resolverSesionEscritura } from "./auth";
import { partesLocales, epochDeLocal, diasEnMes } from "./fechas";
// Regla de inactividad compartida (JUA-25/35/26): un cliente "requiere atención" a
// partir de 15 días sin interacción real, salvo que ya tenga un recordatorio
// próximo planificado. Ver convex/inactividad.ts.
import { MS_DIA, DIAS_INACTIVIDAD, recordatorioProximoIds, diasSinContacto } from "./inactividad";

// Orden de prioridad del cliente para desempatar (JUA-48/49): alta → media → baja
// → sin prioridad (al final).
const RANGO_PRIORIDAD: Record<string, number> = { alta: 0, media: 1, baja: 2 };
const rangoPrioridad = (p: string | null | undefined) => (p != null ? RANGO_PRIORIDAD[p] ?? 3 : 3);

/**
 * Siguiente ocurrencia de un recordatorio recurrente (JUA-115), la primera
 * estrictamente posterior a `ahora` (salta las vencidas no atendidas). Semanal
 * = +7 días; mensual = +1 mes de calendario (mismo día del mes).
 */
function siguienteOcurrencia(
  fecha: number,
  frecuencia: "semanal" | "mensual",
  ahora: number,
  tz: string,
  diaAncla?: number,
  horaLocal?: string,
): number {
  if (frecuencia === "semanal") {
    // +7 días conserva el mismo día de la semana (aprox. en cambios de horario).
    let next = fecha + 7 * MS_DIA;
    while (next <= ahora) next += 7 * MS_DIA;
    return next;
  }
  // Mensual: se calcula en el CALENDARIO DEL NEGOCIO. El ancla es el día-del-mes
  // ORIGINAL (local), ajustado al último día válido del mes destino, conservando
  // la hora local (31 ene → 28/29 feb → 31 mar → 30 abr). Evita el sesgo de UTC
  // en recordatorios nocturnos.
  const base = partesLocales(fecha, tz);
  const ancla = diaAncla ?? base.dia;
  let hh = base.hora;
  let mm = base.minuto;
  if (horaLocal) {
    const [h, m] = horaLocal.split(":").map(Number);
    if (Number.isFinite(h)) hh = h;
    if (Number.isFinite(m)) mm = m;
  }
  let anio = base.anio;
  let mes = base.mes;
  const avanzar = () => {
    mes += 1;
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
    const dia = Math.min(ancla, diasEnMes(anio, mes));
    return epochDeLocal(anio, mes, dia, hh, mm, tz);
  };
  let next = avanzar();
  while (next <= ahora) next = avanzar();
  return next;
}

/**
 * Agenda del día (JUA-23): recordatorios a los que hay que atender hoy.
 *
 * Devuelve los seguimientos del negocio dirigidos a un cliente, pendientes,
 * cuya fecha cae hoy o está vencida. El `negocioId` sale de la sesión (JUA-10);
 * el cliente solo pasa el rango del día ya calculado en la zona horaria del
 * negocio (ventana de visualización de sus propios datos, no de seguridad).
 */
export const agendaDelDia = query({
  args: {
    token: v.string(),
    inicioDia: v.number(),
    finDia: v.number(),
  },
  handler: async (ctx, { token, inicioDia, finDia }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) return [];
    const negocioId = sesion.negocioId;

    const seguimientos = await ctx.db
      .query("seguimientos")
      .withIndex("por_negocio", (q) => q.eq("negocioId", negocioId))
      .collect();

    const relevantes = seguimientos.filter((s) => {
      const esDeHoy = s.fecha >= inicioDia && s.fecha < finDia;
      const estaVencido = s.fecha < inicioDia;
      if (s.estado !== "pendiente" || !(esDeHoy || estaVencido)) return false;
      // Seguimientos de cliente: los ve cualquiera del negocio (JUA-23).
      if (s.destino === "cliente") return s.clienteId != null;
      // Seguimientos a un empleado (JUA-119): aparecen en la agenda del propio
      // empleado (el responsable asignado). El panel de supervisión del admin va aparte.
      return s.destino === "empleado" && s.responsableId === sesion.usuario._id;
    });

    const itemsConNulos = await Promise.all(
      relevantes.map(async (s) => {
        // Seguimiento a empleado (JUA-119): tarea personal, sin cliente vinculado.
        if (s.destino === "empleado") {
          return {
            _id: s._id,
            titulo: s.titulo,
            fecha: s.fecha,
            hora: s.hora ?? null,
            prioridad: s.prioridad,
            destino: "empleado" as const,
            clienteId: null,
            subtitulo: "Tarea personal",
            prioridadCliente: null,
            vencido: s.fecha < inicioDia,
            responsableId: s.responsableId,
            frecuencia: s.frecuencia,
          };
        }
        const cliente = s.clienteId ? await ctx.db.get(s.clienteId) : null;
        // Excluir recordatorios de clientes en papelera (consistencia): si el
        // cliente ya no existe o está eliminado, no aparece en la agenda.
        if (!cliente || cliente.eliminadoEn != null) return null;
        return {
          _id: s._id,
          titulo: s.titulo,
          fecha: s.fecha,
          hora: s.hora ?? null,
          prioridad: s.prioridad,
          destino: "cliente" as const,
          clienteId: s.clienteId ?? null,
          subtitulo: cliente.nombre,
          prioridadCliente: cliente.prioridad ?? null,
          vencido: s.fecha < inicioDia,
          responsableId: s.responsableId,
          frecuencia: s.frecuencia,
        };
      }),
    );
    const items = itemsConNulos.filter((i) => i !== null);

    // Orden (JUA-23 + JUA-48): vencidos primero; luego por hora ascendente (los sin
    // hora, al final); y a igualdad de hora (o ambos sin hora), desempata la
    // prioridad del cliente (alta → media → baja → sin prioridad).
    // TODO(JUA-115): expandir recurrencias antes de aplicar el filtro del día.
    return items.sort((a, b) => {
      if (a.vencido !== b.vencido) return a.vencido ? -1 : 1;
      if (a.hora && b.hora && a.hora !== b.hora) return a.hora.localeCompare(b.hora);
      if (a.hora && !b.hora) return -1;
      if (!a.hora && b.hora) return 1;
      const pr = rangoPrioridad(a.prioridadCliente) - rangoPrioridad(b.prioridadCliente);
      if (pr !== 0) return pr;
      // Desempate final estable (orden determinista): fecha y luego id.
      if (a.fecha !== b.fecha) return a.fecha - b.fecha;
      return a._id < b._id ? -1 : a._id > b._id ? 1 : 0;
    });
  },
});

/**
 * Panel de inactividad (JUA-25): clientes que "requieren atención".
 *
 * Aparece un cliente si: estado ∈ {prospecto, activo, inactivo} (nunca `nuevo`
 * ni `descartado`), no eliminado, sin interacción real en +15 días (o registrado
 * hace +15 días sin interacción) y SIN recordatorio pendiente en los próximos 3
 * días. El `negocioId` sale de la sesión (JUA-10) y `ahora` del tiempo del
 * servidor (granularidad de día; no requiere zona horaria).
 */
export const panelInactividad = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, { token }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) return [];
    const negocioId = sesion.negocioId;
    const ahora = Date.now();

    // Clientes con un recordatorio pendiente en los próximos 3 días: ya tienen
    // seguimiento planificado, así que quedan fuera del panel (regla compartida).
    const seguimientos = await ctx.db
      .query("seguimientos")
      .withIndex("por_negocio", (q) => q.eq("negocioId", negocioId))
      .collect();
    const conRecordatorioProximo = recordatorioProximoIds(seguimientos, ahora);

    const clientes = await ctx.db
      .query("clientes")
      .withIndex("por_negocio", (q) => q.eq("negocioId", negocioId))
      .collect();

    return clientes
      .filter(
        (c) =>
          c.eliminadoEn == null &&
          // Estados que sí cuentan como inactivos (JUA-25): prospecto/activo/inactivo.
          c.estado !== "nuevo" &&
          c.estado !== "descartado" &&
          !conRecordatorioProximo.has(c._id),
      )
      .map((c) => ({
        _id: c._id,
        nombre: c.nombre,
        prioridad: c.prioridad ?? null,
        estado: c.estado,
        diasSinContacto: diasSinContacto(c, ahora),
      }))
      .filter((c) => c.diasSinContacto >= DIAS_INACTIVIDAD)
      // Orden (JUA-49): primero por prioridad del cliente (alta → media → baja →
      // sin prioridad) y, dentro del mismo nivel, más días sin contacto primero.
      // La transición automática a "inactivo" (JUA-26) la persiste
      // clientes.transicionarInactivos / sincronizarInactividad; este panel solo
      // muestra quién "requiere atención" (con el mismo umbral de 15 días).
      .sort((a, b) => {
        const pr = rangoPrioridad(a.prioridad) - rangoPrioridad(b.prioridad);
        if (pr !== 0) return pr;
        if (a.diasSinContacto !== b.diasSinContacto) return b.diasSinContacto - a.diasSinContacto;
        // Desempate final estable (orden determinista): por nombre.
        return a.nombre.localeCompare(b.nombre, "es");
      });
  },
});

/**
 * Marca un recordatorio como realizado desde la lista, sin abrir la ficha
 * (JUA-23 / JUA-24). Al mutar, `agendaDelDia` se recalcula y la card desaparece.
 *
 * Valida que el seguimiento pertenezca al negocio de la sesión (JUA-10): un
 * recurso de otro negocio devuelve el mismo error genérico que uno inexistente,
 * sin revelar si existe.
 */
export const marcarSeguimientoRealizado = mutation({
  args: { token: v.string(), seguimientoId: v.id("seguimientos") },
  handler: async (ctx, { token, seguimientoId }) => {
    const sesion = await resolverSesionEscritura(ctx, token);
    if (!sesion) throw new Error("No autorizado");

    const seguimiento = await ctx.db.get(seguimientoId);
    if (!seguimiento || seguimiento.negocioId !== sesion.negocioId) {
      throw new Error("No encontrado");
    }
    // Solo el responsable asignado o un admin pueden gestionarlo (JUA-24).
    if (seguimiento.responsableId !== sesion.usuario._id && sesion.usuario.rol !== "admin") {
      throw new Error("No autorizado");
    }

    // Recurrente (JUA-115): en vez de cerrarlo, avanza a la próxima ocurrencia
    // (sigue pendiente). Si la próxima supera la fecha de fin, la serie termina.
    if (seguimiento.frecuencia === "semanal" || seguimiento.frecuencia === "mensual") {
      const negocio = await ctx.db.get(seguimiento.negocioId);
      const tz = negocio?.zonaHoraria ?? "America/Mexico_City";
      const next = siguienteOcurrencia(
        seguimiento.fecha,
        seguimiento.frecuencia,
        Date.now(),
        tz,
        seguimiento.diaRecurrencia,
        seguimiento.hora ?? undefined,
      );
      if (seguimiento.fechaFin != null && next > seguimiento.fechaFin) {
        await ctx.db.patch(seguimientoId, { estado: "realizado" });
      } else {
        await ctx.db.patch(seguimientoId, { fecha: next });
      }
      return;
    }

    await ctx.db.patch(seguimientoId, { estado: "realizado" });
  },
});

/**
 * Estado global de clientes (JUA-35). Dashboard agregado del negocio, para ambos
 * roles. Totales por estado (con %), oportunidades abiertas por etapa,
 * seguimientos pendientes/vencidos y clientes "sin atender" (mismo criterio que
 * `panelInactividad`). Negocio derivado de la sesión (JUA-10); reactivo.
 */
export const estadoGlobal = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) return null;
    const negocioId = sesion.negocioId;
    const ahora = Date.now();

    const clientes = (
      await ctx.db.query("clientes").withIndex("por_negocio", (q) => q.eq("negocioId", negocioId)).collect()
    ).filter((c) => c.eliminadoEn == null);
    const total = clientes.length;
    // Solo clientes activos (no en papelera): las oportunidades y seguimientos de
    // un cliente enviado a papelera NO deben sumar al estado global (consistencia).
    const clientesActivosIds = new Set(clientes.map((c) => c._id));
    const ESTADOS = ["nuevo", "prospecto", "activo", "inactivo", "descartado"] as const;
    const porEstado = ESTADOS.map((estado) => {
      const count = clientes.filter((c) => c.estado === estado).length;
      return { estado, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 };
    });

    // Oportunidades abiertas (no cerradas) por etapa, solo de clientes activos.
    const opos = await ctx.db
      .query("oportunidades")
      .withIndex("por_negocio", (q) => q.eq("negocioId", negocioId))
      .collect();
    const CERRADAS = ["ganada", "perdida", "cancelada"];
    const abiertas = opos.filter((o) => !CERRADAS.includes(o.etapa) && clientesActivosIds.has(o.clienteId));
    const ETAPAS_ABIERTAS = ["nueva", "en_contacto", "propuesta", "negociacion"] as const;
    const oportunidades = {
      total: abiertas.length,
      porEtapa: ETAPAS_ABIERTAS.map((etapa) => ({ etapa, count: abiertas.filter((o) => o.etapa === etapa).length })),
    };

    // Seguimientos de clientes activos (no empleado, no clientes en papelera).
    const seguimientos = await ctx.db
      .query("seguimientos")
      .withIndex("por_negocio", (q) => q.eq("negocioId", negocioId))
      .collect();
    const seguimientosClienteActivos = seguimientos.filter(
      (s) => s.destino === "cliente" && s.clienteId != null && clientesActivosIds.has(s.clienteId),
    );
    const pendientes = seguimientosClienteActivos.filter((s) => s.estado === "pendiente");
    const vencidos = pendientes.filter((s) => s.fecha < ahora).length;

    // Clientes sin atender: ≥15 días sin contacto, sin recordatorio próximo
    // planificado y en estado que cuenta (regla compartida, idéntica al panel).
    const conRecordatorioProximo = recordatorioProximoIds(seguimientosClienteActivos, ahora);
    const sinAtender = clientes.filter(
      (c) =>
        c.estado !== "nuevo" &&
        c.estado !== "descartado" &&
        !conRecordatorioProximo.has(c._id) &&
        diasSinContacto(c, ahora) >= DIAS_INACTIVIDAD,
    ).length;

    return {
      total,
      porEstado,
      oportunidades,
      seguimientos: { pendientes: pendientes.length, vencidos },
      sinAtender,
    };
  },
});

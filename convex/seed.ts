import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Datos de demostración para desarrollo (aún no hay altas reales por UI).
// Ejecutar con:  npx convex run seed:poblarDemo
// Reiniciar con: npx convex run seed:limpiar

const MS_DIA = 24 * 60 * 60 * 1000;

// El negocio de demostración se identifica SIEMPRE por este email de admin,
// nunca por "el primer negocio" (evita enganchar datos demo a un negocio real).
const EMAIL_ADMIN_DEMO = "marta@demo.mx";

const CLIENTES = [
  { nombre: "Ana García", prioridad: "alta", estado: "activo", dias: 23 },
  { nombre: "Carlos Ruiz", prioridad: "alta", estado: "prospecto", dias: 19 },
  { nombre: "María López", prioridad: "media", estado: "activo", dias: 17 },
  { nombre: "Juan Torres", prioridad: "baja", estado: "activo", dias: 16 },
  { nombre: "TechStart S.A.", prioridad: "alta", estado: "activo", dias: 3 },
  { nombre: "Roberto Silva", prioridad: "media", estado: "prospecto", dias: 1 },
  // Casos de borde para verificar JUA-25 (panel de inactividad):
  { nombre: "Lucía Fernández", prioridad: "media", estado: "inactivo", dias: 40 }, // Inactivo → SÍ aparece
  { nombre: "Diego Ramos", prioridad: "alta", estado: "nuevo", dias: 40 }, // Nuevo → NO aparece
  { nombre: "Sofía Beltrán", prioridad: "alta", estado: "activo", dias: 25 }, // tiene recordatorio a +2d → NO aparece
] as const;

const SEGUIMIENTOS = [
  { titulo: "Llamar para seguimiento", cliente: "Ana García", hora: "09:00", prioridad: "alta", offsetDias: -2 },
  { titulo: "Enviar propuesta", cliente: "Roberto Silva", hora: "11:30", prioridad: "media", offsetDias: 0 },
  { titulo: "Reunión de cierre", cliente: "TechStart S.A.", hora: "15:00", prioridad: "alta", offsetDias: 0 },
  // Recordatorio futuro (+2 días): saca a Sofía del panel de inactividad (JUA-25).
  { titulo: "Cita agendada", cliente: "Sofía Beltrán", hora: "10:00", prioridad: "alta", offsetDias: 2 },
] as const;

export const poblarDemo = mutation({
  args: {},
  handler: async (ctx) => {
    const ahora = Date.now();

    // Buscar EXPLÍCITAMENTE el negocio demo por su emailAdmin (nunca `.first()`).
    const negocioExistente = await ctx.db
      .query("negocios")
      .filter((q) => q.eq(q.field("emailAdmin"), EMAIL_ADMIN_DEMO))
      .first();
    const negocioId =
      negocioExistente?._id ??
      (await ctx.db.insert("negocios", {
        nombre: "Inmobiliaria Demo",
        emailAdmin: EMAIL_ADMIN_DEMO,
        zonaHoraria: "America/Mexico_City",
        estado: "activo",
      }));

    if (negocioExistente) {
      await ctx.db.patch(negocioId, {
        nombre: "Inmobiliaria Demo",
        zonaHoraria: "America/Mexico_City",
        estado: "activo",
      });
    }

    const usuariosActuales = await ctx.db
      .query("usuarios")
      .withIndex("por_negocio", (q) => q.eq("negocioId", negocioId))
      .collect();

    const martaActual = usuariosActuales.find((u) => u.email === "marta@demo.mx");
    const martaId =
      martaActual?._id ??
      (await ctx.db.insert("usuarios", {
        negocioId,
        nombre: "Marta Ruiz",
        email: "marta@demo.mx",
        rol: "admin",
        estado: "activo",
      }));
    await ctx.db.patch(martaId, {
      nombre: "Marta Ruiz",
      email: "marta@demo.mx",
      rol: "admin",
      estado: "activo",
    });

    const carlosActual = usuariosActuales.find((u) => u.email === "carlos@demo.mx");
    const carlosId =
      carlosActual?._id ??
      (await ctx.db.insert("usuarios", {
        negocioId,
        nombre: "Carlos Díaz",
        email: "carlos@demo.mx",
        rol: "operativo",
        estado: "activo",
      }));
    await ctx.db.patch(carlosId, {
      nombre: "Carlos Díaz",
      email: "carlos@demo.mx",
      rol: "operativo",
      estado: "activo",
    });

    const idClientePorNombre: Record<string, Id<"clientes">> = {};
    const clientesActuales = await ctx.db
      .query("clientes")
      .withIndex("por_negocio", (q) => q.eq("negocioId", negocioId))
      .collect();
    for (const c of CLIENTES) {
      const clienteActual = clientesActuales.find((cliente) => cliente.nombre === c.nombre);
      const datosCliente = {
        negocioId,
        nombre: c.nombre,
        estado: c.estado,
        prioridad: c.prioridad,
        responsableId: carlosId,
        ultimaInteraccion: ahora - c.dias * MS_DIA,
        eliminadoEn: undefined,
      };
      if (clienteActual) {
        await ctx.db.patch(clienteActual._id, datosCliente);
        idClientePorNombre[c.nombre] = clienteActual._id;
      } else {
        idClientePorNombre[c.nombre] = await ctx.db.insert("clientes", datosCliente);
      }
    }

    const seguimientosActuales = await ctx.db
      .query("seguimientos")
      .withIndex("por_negocio", (q) => q.eq("negocioId", negocioId))
      .collect();
    for (const s of SEGUIMIENTOS) {
      const clienteId = idClientePorNombre[s.cliente];
      const seguimientoActual = seguimientosActuales.find(
        (seguimiento) =>
          seguimiento.destino === "cliente" &&
          seguimiento.clienteId === clienteId &&
          seguimiento.titulo === s.titulo,
      );
      const datosSeguimiento = {
        negocioId,
        destino: "cliente",
        clienteId,
        titulo: s.titulo,
        fecha: ahora + s.offsetDias * MS_DIA,
        hora: s.hora,
        responsableId: carlosId,
        prioridad: s.prioridad,
        frecuencia: "una_vez",
        estado: "pendiente",
      } as const;

      if (seguimientoActual) {
        await ctx.db.patch(seguimientoActual._id, datosSeguimiento);
      } else {
        await ctx.db.insert("seguimientos", datosSeguimiento);
      }
    }

    return {
      negocioId,
      martaId,
      carlosId,
      clientes: CLIENTES.length,
      seguimientos: SEGUIMIENTOS.length,
      nota: negocioExistente ? "demo actualizado" : "demo creado",
    };
  },
});

export const limpiar = mutation({
  args: {},
  handler: async (ctx) => {
    const tablas = [
      "seguimientos",
      "notas",
      "oportunidades",
      "ventas",
      "clientes",
      "invitaciones",
      "usuarios",
      "negocios",
    ] as const;
    for (const tabla of tablas) {
      const docs = await ctx.db.query(tabla).collect();
      await Promise.all(docs.map((d) => ctx.db.delete(d._id)));
    }
    return { ok: true };
  },
});

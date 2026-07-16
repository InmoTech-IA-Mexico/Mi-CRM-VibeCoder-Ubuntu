import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { hashPassword } from "./auth";

// Datos de demostración para desarrollo (aún no hay altas reales por UI).
// Ejecutar con:  npx convex run seed:poblarDemo
// Reiniciar con: npx convex run seed:limpiar
//
// SEGURIDAD (JUA-10): son `internalMutation` a propósito → NO forman parte del
// API público (`api.seed.*`), así que ningún cliente puede invocarlas. Solo se
// ejecutan desde el CLI/dashboard con credenciales de administrador. `limpiar`
// es destructiva (borra tablas enteras); nunca debe quedar expuesta al cliente.

const MS_DIA = 24 * 60 * 60 * 1000;

// Contraseña inicial de los usuarios demo (remediación B-1, dictamen DOC-3 v1):
// el repo es PÚBLICO, así que NUNCA va hardcodeada. Se lee de las variables de
// entorno del deployment, OBLIGATORIAS y SEPARADAS POR ROL (OBS-2 / JUA-125 —
// sin respaldo genérico: los deployments existentes ya migraron), y SOLO se usa
// al CREAR el usuario (re-ejecutar el seed jamás pisa la contraseña de un
// usuario existente; las rotaciones sobreviven).
function passwordInicialDemo(rol: "admin" | "operativo"): string {
  const variable = rol === "admin" ? "SEED_DEMO_PASSWORD_ADMIN" : "SEED_DEMO_PASSWORD_OPERATIVO";
  const pass = process.env[variable];
  if (!pass) {
    throw new Error(`Define ${variable} en las variables de entorno del deployment para sembrar usuarios demo`);
  }
  return pass;
}

// El negocio de demostración se identifica SIEMPRE por este email de admin,
// nunca por "el primer negocio" (evita enganchar datos demo a un negocio real).
const EMAIL_ADMIN_DEMO = "marta@demo.mx";

const CLIENTES = [
  { nombre: "Ana García", prioridad: "alta", estado: "activo", dias: 23, tipo: "persona", empresa: "García & Asociados", telefono: "55 1002 3040", email: "ana@garcia.mx", canal: "whatsapp" },
  { nombre: "Carlos Ruiz", prioridad: "alta", estado: "prospecto", dias: 19, tipo: "persona", empresa: "Ruiz Consultoría", telefono: "55 2210 4455", email: "carlos.ruiz@gmail.com", canal: "referido" },
  { nombre: "María López", prioridad: "media", estado: "activo", dias: 17, tipo: "persona", empresa: "Inmuebles del Valle", telefono: "55 3321 8890", email: "maria.lopez@valle.mx", canal: "web" },
  { nombre: "Juan Torres", prioridad: "baja", estado: "activo", dias: 16, tipo: "persona", empresa: undefined, telefono: "55 4456 1122", email: "juan.torres@outlook.com", canal: "telefono" },
  { nombre: "TechStart S.A.", prioridad: "alta", estado: "activo", dias: 3, tipo: "empresa", empresa: "TechStart S.A.", telefono: "55 5567 7788", email: "contacto@techstart.mx", canal: "email" },
  { nombre: "Roberto Silva", prioridad: "media", estado: "prospecto", dias: 1, tipo: "persona", empresa: undefined, telefono: "55 6678 9900", email: "roberto.silva@gmail.com", canal: "redes" },
  // Casos de borde para verificar JUA-25 (panel de inactividad):
  { nombre: "Lucía Fernández", prioridad: "media", estado: "inactivo", dias: 40, tipo: "persona", empresa: "Fernández Interiores", telefono: "55 7789 3344", email: "lucia@fernandez.mx", canal: "whatsapp" }, // Inactivo → SÍ aparece
  { nombre: "Diego Ramos", prioridad: "alta", estado: "nuevo", dias: 40, tipo: "persona", empresa: undefined, telefono: "55 8890 2211", email: undefined, canal: undefined }, // Nuevo (sin contacto) → NO aparece
  { nombre: "Sofía Beltrán", prioridad: "alta", estado: "activo", dias: 25, tipo: "persona", empresa: "Beltrán & Co", telefono: "55 9901 5566", email: "sofia.beltran@beltranco.mx", canal: "referido" }, // tiene recordatorio a +2d → NO aparece
] as const;

const SEGUIMIENTOS = [
  { titulo: "Llamar para seguimiento", cliente: "Ana García", hora: "09:00", prioridad: "alta", offsetDias: -2 },
  { titulo: "Enviar propuesta", cliente: "Roberto Silva", hora: "11:30", prioridad: "media", offsetDias: 0 },
  { titulo: "Reunión de cierre", cliente: "TechStart S.A.", hora: "15:00", prioridad: "alta", offsetDias: 0 },
  // Recordatorio futuro (+2 días): saca a Sofía del panel de inactividad (JUA-25).
  { titulo: "Cita agendada", cliente: "Sofía Beltrán", hora: "10:00", prioridad: "alta", offsetDias: 2 },
] as const;

// Oportunidades: abiertas (pipeline, JUA-14) + cerradas del mes (Resumen del mes, JUA-34).
const OPORTUNIDADES: {
  cliente: string;
  nombre: string;
  etapa: "nueva" | "en_contacto" | "propuesta" | "negociacion" | "ganada" | "perdida" | "cancelada";
  monto?: number;
  modeloVenta?: "unico" | "recurrente";
  motivo?: string;
}[] = [
  // Abiertas
  { cliente: "Ana García", nombre: "Departamento Polanco", etapa: "en_contacto" },
  { cliente: "María López", nombre: "Casa Del Valle", etapa: "propuesta" },
  { cliente: "TechStart S.A.", nombre: "Oficinas corporativas", etapa: "negociacion" },
  { cliente: "Carlos Ruiz", nombre: "Terreno sur", etapa: "nueva" },
  { cliente: "Roberto Silva", nombre: "Local comercial", etapa: "nueva" },
  // Cerradas del mes
  { cliente: "Ana García", nombre: "Penthouse Reforma", etapa: "ganada", monto: 2500000, modeloVenta: "unico" },
  { cliente: "TechStart S.A.", nombre: "Renta oficinas anual", etapa: "ganada", monto: 480000, modeloVenta: "recurrente" },
  { cliente: "Roberto Silva", nombre: "Consultorio Roma", etapa: "ganada", monto: 1200000, modeloVenta: "unico" },
  { cliente: "María López", nombre: "Casa Coyoacán", etapa: "perdida", motivo: "Precio fuera de presupuesto" },
  { cliente: "Carlos Ruiz", nombre: "Bodega norte", etapa: "cancelada", motivo: "Cliente pospuso la compra" },
];

// Notas demo para el historial (JUA-18). Para Ana, el "interno" (offset 20) es más
// reciente que su última llamada (offset 23) y NO cuenta como contacto → ilustra
// la regla JUA-19 (sigue "Hace 23 días sin contacto"). `autor`: c=Carlos, m=Marta.
const NOTAS = [
  { cliente: "Ana García", tipo: "interno", descripcion: "Cliente clave para el cierre de trimestre. Prefiere contacto por la tarde.", autor: "m", offsetDias: 20 },
  { cliente: "Ana García", tipo: "llamada", descripcion: "Ana confirmó que está evaluando la propuesta. Hablar la próxima semana.", resultado: "Interesado", autor: "c", offsetDias: 23 },
  { cliente: "Ana García", tipo: "correo", descripcion: "Propuesta enviada por email con el detalle de precios.", resultado: "Pendiente", autor: "c", offsetDias: 25 },
  { cliente: "Ana García", tipo: "reunion", descripcion: "Primera reunión. Muy receptiva al servicio. Solicita propuesta escrita.", autor: "c", offsetDias: 30 },
] as const;

// Ventas demo para el panel de Ventas (JUA-112/113). El canal del desglose sale
// del cliente. `autor`: c=Carlos, m=Marta. offsetDias grande (40) → mes anterior.
const VENTAS_DEMO = [
  { cliente: "Ana García", importe: 45000, autor: "c", offsetDias: 10, oportunidad: "Departamento Polanco" },
  { cliente: "TechStart S.A.", importe: 80000, autor: "m", offsetDias: 5, oportunidad: "Oficinas corporativas" },
  { cliente: "María López", importe: 22000, autor: "c", offsetDias: 15, oportunidad: "Casa Del Valle" },
  { cliente: "Roberto Silva", importe: 12000, autor: "m", offsetDias: 3, oportunidad: "Local comercial" },
  { cliente: "Ana García", importe: 30000, autor: "m", offsetDias: 40, oportunidad: null }, // mes anterior (para % variación)
] as const;

export const poblarDemo = internalMutation({
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

    // La contraseña SOLO se fija al crear (nunca se pisa la de un usuario
    // existente — las rotaciones sobreviven a la re-siembra).
    const martaActual = usuariosActuales.find((u) => u.email === "marta@demo.mx");
    const martaId =
      martaActual?._id ??
      (await ctx.db.insert("usuarios", {
        negocioId,
        nombre: "Marta Ruiz",
        email: "marta@demo.mx",
        rol: "admin",
        estado: "activo",
        passwordHash: hashPassword(passwordInicialDemo("admin")),
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
        passwordHash: hashPassword(passwordInicialDemo("operativo")),
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
        tipo: c.tipo,
        empresa: c.empresa,
        telefono: c.telefono,
        email: c.email,
        canal: c.canal,
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

    for (const o of OPORTUNIDADES) {
      const clienteId = idClientePorNombre[o.cliente];
      if (!clienteId) continue;
      const existentes = await ctx.db
        .query("oportunidades")
        .withIndex("por_cliente", (q) => q.eq("clienteId", clienteId))
        .collect();
      const cerrada = ["ganada", "perdida", "cancelada"].includes(o.etapa);
      const datosOpo = {
        negocioId,
        clienteId,
        nombre: o.nombre,
        etapa: o.etapa,
        responsableId: carlosId,
        ...(o.monto != null ? { monto: o.monto } : {}),
        ...(o.modeloVenta ? { modeloVenta: o.modeloVenta } : {}),
        ...(o.motivo ? { motivoPerdida: o.motivo } : {}),
        // Fecha de cierre ≈ cuando se marcó cerrada (para el Resumen del mes).
        ...(cerrada ? { actualizadoEn: Date.now() } : {}),
      };
      const prev = existentes.find((e) => e.nombre === o.nombre);
      if (prev) await ctx.db.patch(prev._id, datosOpo);
      else await ctx.db.insert("oportunidades", datosOpo);
    }

    // Notas demo (idempotente): se insertan solo para clientes que aún no tienen
    // ninguna nota (evita duplicar en re-ejecuciones de poblarDemo).
    const clientesConNotas = new Set<string>();
    for (const nombre of new Set(NOTAS.map((n) => n.cliente))) {
      const clienteId = idClientePorNombre[nombre];
      if (!clienteId) continue;
      const existentes = await ctx.db
        .query("notas")
        .withIndex("por_cliente", (q) => q.eq("clienteId", clienteId))
        .collect();
      if (existentes.length > 0) clientesConNotas.add(nombre);
    }
    for (const n of NOTAS) {
      const clienteId = idClientePorNombre[n.cliente];
      if (!clienteId || clientesConNotas.has(n.cliente)) continue;
      await ctx.db.insert("notas", {
        negocioId,
        clienteId,
        tipo: n.tipo,
        descripcion: n.descripcion,
        resultado: "resultado" in n ? n.resultado : undefined,
        autorId: n.autor === "m" ? martaId : carlosId,
        fecha: ahora - n.offsetDias * MS_DIA,
      });
    }

    // Ventas demo (idempotente): solo si el negocio aún no tiene ventas. Aparecen
    // en el historial de cada cliente (JUA-110) y en el panel de Ventas (JUA-112/113).
    const ventasNegocio = await ctx.db
      .query("ventas")
      .withIndex("por_negocio", (q) => q.eq("negocioId", negocioId))
      .collect();
    if (ventasNegocio.length === 0) {
      for (const vt of VENTAS_DEMO) {
        const clienteId = idClientePorNombre[vt.cliente];
        if (!clienteId) continue;
        let oportunidadId: Id<"oportunidades"> | undefined;
        if (vt.oportunidad) {
          const opos = await ctx.db
            .query("oportunidades")
            .withIndex("por_cliente", (q) => q.eq("clienteId", clienteId))
            .collect();
          oportunidadId = opos.find((o) => o.nombre === vt.oportunidad)?._id;
        }
        await ctx.db.insert("ventas", {
          negocioId,
          clienteId,
          oportunidadId,
          importe: vt.importe,
          fecha: ahora - vt.offsetDias * MS_DIA,
          registradoPorId: vt.autor === "m" ? martaId : carlosId,
        });
      }
    }

    return {
      negocioId,
      martaId,
      carlosId,
      clientes: CLIENTES.length,
      seguimientos: SEGUIMIENTOS.length,
      oportunidades: OPORTUNIDADES.length,
      notas: NOTAS.length,
      ventas: VENTAS_DEMO.length,
      nota: negocioExistente ? "demo actualizado" : "demo creado",
    };
  },
});

export const limpiar = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tablas = [
      "sesiones",
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

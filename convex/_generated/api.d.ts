/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as clientes from "../clientes.js";
import type * as crons from "../crons.js";
import type * as csv from "../csv.js";
import type * as enumsServidor from "../enumsServidor.js";
import type * as etiquetas from "../etiquetas.js";
import type * as exportaciones from "../exportaciones.js";
import type * as fechas from "../fechas.js";
import type * as inactividad from "../inactividad.js";
import type * as inicio from "../inicio.js";
import type * as invitaciones from "../invitaciones.js";
import type * as notas from "../notas.js";
import type * as notificaciones from "../notificaciones.js";
import type * as oportunidades from "../oportunidades.js";
import type * as push from "../push.js";
import type * as pushEnvio from "../pushEnvio.js";
import type * as recuperacion from "../recuperacion.js";
import type * as seed from "../seed.js";
import type * as seguimientos from "../seguimientos.js";
import type * as usuarios from "../usuarios.js";
import type * as ventas from "../ventas.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  clientes: typeof clientes;
  crons: typeof crons;
  csv: typeof csv;
  enumsServidor: typeof enumsServidor;
  etiquetas: typeof etiquetas;
  exportaciones: typeof exportaciones;
  fechas: typeof fechas;
  inactividad: typeof inactividad;
  inicio: typeof inicio;
  invitaciones: typeof invitaciones;
  notas: typeof notas;
  notificaciones: typeof notificaciones;
  oportunidades: typeof oportunidades;
  push: typeof push;
  pushEnvio: typeof pushEnvio;
  recuperacion: typeof recuperacion;
  seed: typeof seed;
  seguimientos: typeof seguimientos;
  usuarios: typeof usuarios;
  ventas: typeof ventas;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

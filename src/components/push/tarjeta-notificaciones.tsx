"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useAction, useQuery } from "convex/react";
import { Bell, AlertCircle, Smartphone, Send } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useSesion } from "@/components/session/use-sesion";
import { LABELS, type PrefClienteFrio } from "@/lib/enums";
import { cn } from "@/lib/utils";

// Alerta push de cliente frío (JUA-33): activar/desactivar las notificaciones de
// ESTE dispositivo. La suscripción (Web Push) se guarda en Convex; el envío real
// llega en una fase posterior. iOS solo admite push si el PWA está instalado.

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** Convierte la clave pública VAPID (base64url) al formato que espera pushManager. */
function base64UrlToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function TarjetaNotificaciones() {
  const { token } = useSesion();
  const guardar = useMutation(api.push.guardarSubscription);
  const borrar = useMutation(api.push.borrarSubscription);
  const enviarPrueba = useAction(api.pushEnvio.enviarPrueba);
  const preferencia = useQuery(api.push.miPreferenciaFrio, { token });
  const guardarPref = useMutation(api.push.guardarPreferenciaFrio);

  // Navegador compatible (independiente de la config). `configurado` = la clave
  // pública VAPID está presente (obs. OBS-3: distinguir "no compatible" de "config
  // de despliegue pendiente" — p. ej. falta el env en Railway).
  const [soportado, setSoportado] = useState<boolean | null>(null);
  const configurado = !!VAPID_PUBLIC;
  const [activa, setActiva] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [denegado, setDenegado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [probando, setProbando] = useState(false);
  const [resultadoPrueba, setResultadoPrueba] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    const detectar = async () => {
      const navOk =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      let activaLocal = false;
      if (navOk && !!VAPID_PUBLIC) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          const sub = await reg?.pushManager.getSubscription();
          const json = sub?.toJSON();
          if (sub && json?.keys?.p256dh && json.keys.auth) {
            // B-1: al montar, re-asocia el endpoint al usuario ACTUAL de la sesión
            // (upsert idempotente). Evita que, tras cambiar de cuenta en el mismo
            // navegador, la fila remota siga apuntando al usuario anterior.
            await guardar({ token, endpoint: sub.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth });
            activaLocal = true;
          }
        } catch {
          /* sin registro previo */
        }
      }
      if (cancelado) return;
      setSoportado(navOk);
      setDenegado(navOk && Notification.permission === "denied");
      setActiva(activaLocal);
    };
    void detectar();
    return () => {
      cancelado = true;
    };
  }, [guardar, token]);

  const activar = useCallback(async () => {
    setOcupado(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setDenegado(permiso === "denied");
        setError("No diste permiso para recibir notificaciones.");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC!),
      });
      const json = sub.toJSON();
      if (!json.keys?.p256dh || !json.keys?.auth) throw new Error("Suscripción sin claves");
      await guardar({ token, endpoint: sub.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth });
      setActiva(true);
    } catch (e) {
      console.error("No se pudieron activar las notificaciones", e);
      setError("No se pudieron activar. Inténtalo de nuevo.");
    } finally {
      setOcupado(false);
    }
  }, [guardar, token]);

  const desactivar = useCallback(async () => {
    setOcupado(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await borrar({ token, endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setActiva(false);
    } catch (e) {
      console.error("No se pudieron desactivar las notificaciones", e);
      setError("No se pudieron desactivar. Inténtalo de nuevo.");
    } finally {
      setOcupado(false);
    }
  }, [borrar, token]);

  const probar = useCallback(async () => {
    setProbando(true);
    setResultadoPrueba(null);
    setError(null);
    try {
      const r = await enviarPrueba({ token });
      // B-3: el mensaje distingue "sin dispositivos" (total 0) de éxito total,
      // entrega parcial y fallo total; no se confunde un fallo con "no hay".
      let msg: string;
      if (r.total === 0) {
        msg = "No hay dispositivos suscritos ahora mismo.";
      } else if (r.enviadas === r.total) {
        msg = `Enviada a ${r.enviadas} ${r.enviadas === 1 ? "dispositivo" : "dispositivos"}.`;
      } else if (r.enviadas > 0) {
        msg = `Enviada a ${r.enviadas} de ${r.total}; ${r.total - r.enviadas} no se pudo entregar.`;
      } else {
        msg = "No se pudo entregar a ningún dispositivo. Revisa la conexión e inténtalo de nuevo.";
      }
      setResultadoPrueba(msg);
    } catch (e) {
      console.error("No se pudo enviar la notificación de prueba", e);
      setError("No se pudo enviar la notificación de prueba.");
    } finally {
      setProbando(false);
    }
  }, [enviarPrueba, token]);

  if (soportado === null) return null; // detectando (evita parpadeo)

  return (
    <section>
      <p className="mb-3 px-1 text-[12px] font-semibold uppercase tracking-wider text-gold-text">Notificaciones</p>
      <div className="flex flex-col gap-3 rounded-[18px] border border-neutral-100 bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Bell size={19} strokeWidth={1.7} className="flex-shrink-0 text-body" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] text-ink">Avisos de cliente frío</p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-muted">
              Te avisamos cuando un cliente lleva 15 días sin contacto, aunque la app esté cerrada.
            </p>
          </div>
          {soportado && configurado && (
            <button
              type="button"
              role="switch"
              aria-checked={activa}
              aria-label="Activar notificaciones de cliente frío"
              aria-busy={ocupado}
              disabled={ocupado || denegado}
              onClick={() => (activa ? desactivar() : activar())}
              className={cn(
                "relative h-7 w-12 flex-shrink-0 rounded-full transition disabled:opacity-50",
                activa ? "bg-gold-500" : "bg-neutral-200",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-6 w-6 rounded-full bg-surface shadow transition-transform",
                  activa ? "translate-x-[22px]" : "translate-x-0.5",
                )}
              />
            </button>
          )}
        </div>

        {/* Preferencia de alertas (JUA-33 B-2): QUÉ alertas quiere el usuario, aparte del dispositivo */}
        {soportado && configurado && preferencia && preferencia.rol !== "observador" && (
          <div className="flex flex-col gap-2 border-t border-neutral-100 pt-3">
            <p className="text-[13px] font-medium text-ink">¿Qué alertas de cliente frío recibir?</p>
            <div className="flex gap-1.5 rounded-2xl border border-[#E0D9C9] bg-[#F0ECE2] p-1">
              {(preferencia.rol === "admin"
                ? (["ninguna", "pool", "negocio"] as const)
                : (["cartera", "ninguna"] as const)
              ).map((op: PrefClienteFrio) => (
                <button
                  key={op}
                  type="button"
                  aria-pressed={preferencia.pref === op}
                  onClick={() => {
                    if (preferencia.pref !== op) void guardarPref({ token, pref: op });
                  }}
                  className={cn(
                    "h-9 flex-1 rounded-[10px] text-[12.5px] transition",
                    preferencia.pref === op ? "bg-surface font-semibold text-ink shadow-sm" : "font-medium text-body",
                  )}
                >
                  {LABELS.prefClienteFrio[op]}
                </button>
              ))}
            </div>
          </div>
        )}

        {activa && soportado && configurado && (
          <div className="flex flex-col gap-2 border-t border-neutral-100 pt-3">
            <button
              type="button"
              onClick={probar}
              disabled={probando}
              aria-busy={probando}
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-border-input bg-surface text-[13.5px] font-semibold text-ink active:scale-[0.99] disabled:opacity-50"
            >
              <Send size={15} strokeWidth={1.9} className="text-body" />
              {probando ? "Enviando…" : "Enviar notificación de prueba"}
            </button>
            {resultadoPrueba && (
              <p className="text-center text-[12px] text-muted">{resultadoPrueba}</p>
            )}
          </div>
        )}

        {!soportado && (
          <div className="flex items-start gap-2 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5">
            <Smartphone size={15} strokeWidth={1.8} className="mt-0.5 flex-shrink-0 text-neutral-400" />
            <p className="text-[12px] leading-snug text-muted">
              Tu navegador no admite notificaciones push. En iPhone, primero <b>agrega la app a la pantalla de
              inicio</b> (Compartir → Agregar a inicio) y ábrela desde ahí.
            </p>
          </div>
        )}

        {/* OBS-3: el navegador es compatible pero falta la clave pública VAPID
            (config de despliegue), distinto de "navegador no compatible". */}
        {soportado && !configurado && (
          <div className="flex items-start gap-2 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5">
            <AlertCircle size={15} strokeWidth={1.9} className="mt-0.5 flex-shrink-0 text-neutral-400" />
            <p className="text-[12px] leading-snug text-muted">
              Las notificaciones aún no están disponibles en este entorno. Inténtalo más tarde.
            </p>
          </div>
        )}

        {denegado && soportado && configurado && (
          <div className="flex items-start gap-2 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5">
            <AlertCircle size={15} strokeWidth={1.9} className="mt-0.5 flex-shrink-0 text-neutral-400" />
            <p className="text-[12px] leading-snug text-muted">
              Bloqueaste las notificaciones para este sitio. Actívalas en los ajustes del navegador para recibir avisos.
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-[#F9ECE7] px-3 py-2.5">
            <AlertCircle size={16} strokeWidth={1.9} className="flex-shrink-0 text-danger" />
            <p className="text-[12.5px] font-medium text-[#8A3F2C]">{error}</p>
          </div>
        )}
      </div>
    </section>
  );
}

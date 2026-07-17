"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { Bell, AlertCircle, Smartphone } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useSesion } from "@/components/session/use-sesion";
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

  const [soportado, setSoportado] = useState<boolean | null>(null);
  const [activa, setActiva] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [denegado, setDenegado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      !!VAPID_PUBLIC;
    setSoportado(ok);
    if (!ok) return;
    setDenegado(Notification.permission === "denied");
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setActiva(!!sub))
      .catch(() => {});
  }, []);

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
          {soportado && (
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

        {!soportado && (
          <div className="flex items-start gap-2 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5">
            <Smartphone size={15} strokeWidth={1.8} className="mt-0.5 flex-shrink-0 text-neutral-400" />
            <p className="text-[12px] leading-snug text-muted">
              Tu navegador no admite notificaciones push. En iPhone, primero <b>agrega la app a la pantalla de
              inicio</b> (Compartir → Agregar a inicio) y ábrela desde ahí.
            </p>
          </div>
        )}

        {denegado && soportado && (
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

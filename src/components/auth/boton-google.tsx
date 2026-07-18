"use client";

import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { GoogleOAuthProvider, GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { api } from "../../../convex/_generated/api";

// Botón "Continuar con Google" (JUA-40). Solo AUTENTICA (no registra). Se muestra solo
// si hay Client ID configurado (sin `NEXT_PUBLIC_GOOGLE_CLIENT_ID` se oculta, como la
// tarjeta de push). El nonce (anti-replay) se genera EN EL CLIENTE y viaja en el ID
// token; el backend lo registra como consumido solo tras verificar el token EN SERVIDOR
// (sin ruta de emisión anónima → sin DoS de nonces, obs. B-1). Errores genéricos.

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

/** ¿Está configurado el login con Google? (para ocultar separadores/secciones sin Client ID.) */
export const googleConfigurado = !!CLIENT_ID;

/** Nonce aleatorio del lado del cliente (hex de 16 bytes). */
function generarNonce(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

type Props =
  | { modo: "login"; onOk: (token: string) => void; onError?: (msg: string) => void }
  | { modo: "vincular"; token: string; onOk: () => void; onError?: (msg: string) => void };

export function BotonGoogle(props: Props) {
  if (!CLIENT_ID) return null;
  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <BotonInterno {...props} />
    </GoogleOAuthProvider>
  );
}

function mensajeError(e: unknown): string {
  const m = e instanceof Error ? e.message.replace(/^\[.*?\]\s*/, "") : "";
  return m && !/Uncaught|Server Error/.test(m) ? m : "No se pudo continuar con Google.";
}

function BotonInterno(props: Props) {
  const modo = props.modo;
  const iniciar = useAction(api.googleAction.iniciarSesionGoogle);
  const vincular = useAction(api.googleAction.vincularGoogle);
  const [nonce, setNonce] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Genera el nonce tras montar (evita desajuste de hidratación: null en SSR y primer
  // render; el setState va dentro de una async, no en el cuerpo del efecto).
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      if (!cancelado) setNonce(generarNonce());
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const onSuccess = async (cred: CredentialResponse) => {
    if (!cred.credential || !nonce || ocupado) return;
    setOcupado(true);
    try {
      if (props.modo === "login") {
        const r = await iniciar({ idToken: cred.credential, nonce });
        props.onOk(r.token);
      } else {
        await vincular({ token: props.token, idToken: cred.credential, nonce });
        props.onOk();
      }
    } catch (e) {
      console.error("No se pudo continuar con Google", e);
      props.onError?.(mensajeError(e));
      setNonce(generarNonce()); // el nonce se consumió → uno nuevo para reintentar
    } finally {
      setOcupado(false);
    }
  };

  if (!nonce) return null; // brevísimo, hasta generar el nonce en el cliente

  return (
    <div className="flex justify-center">
      <GoogleLogin
        nonce={nonce}
        onSuccess={(cred) => void onSuccess(cred)}
        onError={() => props.onError?.("No se pudo continuar con Google.")}
        text={modo === "login" ? "continue_with" : "signin_with"}
      />
    </div>
  );
}

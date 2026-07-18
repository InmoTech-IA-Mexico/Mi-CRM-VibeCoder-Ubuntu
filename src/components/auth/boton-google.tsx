"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useAction } from "convex/react";
import { GoogleOAuthProvider, GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { api } from "../../../convex/_generated/api";

// Botón "Continuar con Google" (JUA-40). Solo AUTENTICA (no registra). Se muestra solo
// si hay Client ID configurado (sin la env `NEXT_PUBLIC_GOOGLE_CLIENT_ID` se oculta,
// como la tarjeta de push). Pide un nonce al backend, lo pasa a GIS (viaja en el ID
// token) y llama a la action, que verifica el token EN SERVIDOR. Errores genéricos.

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

/** ¿Está configurado el login con Google? (para ocultar separadores/secciones sin Client ID.) */
export const googleConfigurado = !!CLIENT_ID;

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
  const token = props.modo === "vincular" ? props.token : undefined;
  const emitirLogin = useMutation(api.google.emitirNonceLogin);
  const emitirVincular = useMutation(api.google.emitirNonceVincular);
  const iniciar = useAction(api.googleAction.iniciarSesionGoogle);
  const vincular = useAction(api.googleAction.vincularGoogle);
  const [nonce, setNonce] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Reintento de nonce tras consumir/expirar (se llama desde el manejador de éxito).
  const pedirNonce = useCallback(async () => {
    try {
      const r = modo === "login" ? await emitirLogin({}) : await emitirVincular({ token: token! });
      setNonce(r.nonce);
    } catch {
      setNonce(null);
    }
  }, [modo, token, emitirLogin, emitirVincular]);

  // Primer nonce al montar: el setState va DENTRO de la async (tras await), no en el
  // cuerpo del efecto (regla react-hooks/set-state-in-effect).
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const r = modo === "login" ? await emitirLogin({}) : await emitirVincular({ token: token! });
        if (!cancelado) setNonce(r.nonce);
      } catch {
        if (!cancelado) setNonce(null);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [modo, token, emitirLogin, emitirVincular]);

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
      void pedirNonce(); // el nonce se consumió/expiró → pide otro para reintentar
    } finally {
      setOcupado(false);
    }
  };

  if (!nonce) return null; // esperando el nonce

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

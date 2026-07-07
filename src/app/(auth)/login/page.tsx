import { FormularioLogin } from "./_components/formulario-login";

// Pantalla de Login (JUA-6). Diseño: design/design_handoff_inmotech_crm/Login.dc.html
// Autenticación real pendiente (JUA-6 / JUA-30): por ahora "Entrar" pasa a la
// sesión simulada y aterriza en /inicio.
export default function Page() {
  return <FormularioLogin />;
}

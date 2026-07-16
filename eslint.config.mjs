import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prototipos de diseño (HTML/JS de referencia, no código de la app).
    "design/**",
    // Código generado por Convex.
    "convex/_generated/**",
    // Actas, evidencia y drivers de QA archivados (no es código de la app).
    "tmp/**",
    "auditorias/**",
  ]),
]);

export default eslintConfig;

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "InmoTech IA México — CRM",
    short_name: "InmoTech IA",
    description: "CRM móvil para negocios pequeños: clientes, seguimientos, oportunidades y ventas.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf8f1",
    theme_color: "#fbf8f1",
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

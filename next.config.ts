import type { NextConfig } from "next";

// Cabeceras de seguridad de las rutas públicas del registro (JUA-39, control 6 del dictamen):
// sin referrer, no indexables y no cacheables (procesan/exponen tokens de capacidad).
const CABECERAS_REGISTRO = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Cache-Control", value: "no-store" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/registro", headers: CABECERAS_REGISTRO },
      { source: "/registro/:path*", headers: CABECERAS_REGISTRO },
      { source: "/api/registro", headers: CABECERAS_REGISTRO },
    ];
  },
};

export default nextConfig;

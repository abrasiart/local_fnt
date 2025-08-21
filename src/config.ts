// frontend/src/config.ts

// Base da API: em produção use o proxy do Vercel (/api);
// em desenvolvimento você pode definir REACT_APP_API_URL=http://localhost:4000
const RAW_API_BASE = process.env.REACT_APP_API_URL || "/api";

/** Base da API sem barra no final */
export const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

/** Monta URL garantindo a barra inicial do path */
export const apiUrl = (path: string) =>
  `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

/** Endpoints úteis (opcional) */
export const endpoints = {
  health: () => apiUrl("/health"),
  produtos: () => apiUrl("/produtos"),
  pdvs: (qs?: string) => apiUrl(`/pdvs${qs ? `?${qs}` : ""}`),
};

// (opcional) Token do Mapbox, se você usar no mapa
export const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN ?? "";

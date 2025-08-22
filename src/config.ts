// src/config.ts
// Usa a env REACT_APP_API_URL se existir; caso contrário, cai para "/api" (rewrite do Vercel)
export const API_BASE =
  (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.trim() !== '')
    ? process.env.REACT_APP_API_URL
    : '/api';

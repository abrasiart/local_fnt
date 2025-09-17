// src/config.ts
// Usa a env REACT_APP_API_URL se existir; caso contrário, cai para "/api" (rewrite do Vercel)
// src/config.ts
export const API_BASE =
  process.env.REACT_APP_API_URL || "http://localhost:4000";

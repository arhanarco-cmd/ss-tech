// @ts-ignore
const envUrl = import.meta.env.VITE_API_URL;
export const API_BASE = (envUrl && envUrl.trim() !== "" ? envUrl : (import.meta.env.PROD ? "https://sstech-server.onrender.com" : "")).replace(/\/$/, "");

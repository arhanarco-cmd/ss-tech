const envUrl = ((import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || '').trim();
export const API_BASE = (envUrl !== '' ? envUrl : 'https://sstech-server.onrender.com').replace(/\/$/, '');

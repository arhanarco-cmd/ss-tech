const envUrl = ((import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || '').trim();
export const API_BASE = (envUrl !== '' ? envUrl : 'https://sstech-server.onrender.com').replace(/\/$/, '');

export const getMediaUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
};

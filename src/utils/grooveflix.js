export function getGrooveflixCdnBaseUrl() {
  const raw = String(import.meta.env.VITE_GROOVEFLIX_CDN_BASE_URL || '').trim();
  return raw.replace(/\/+$/, '');
}

export function buildGrooveflixUrl(path) {
  const base = getGrooveflixCdnBaseUrl();
  if (!base) return null;
  const p = String(path || '').replace(/^\/+/, '');
  if (!p) return null;
  return `${base}/${p}`;
}


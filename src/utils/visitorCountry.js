const STORAGE_KEY = 'rg_visitor_country_v1';

export function getCachedVisitorCountry() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const v = String(raw).trim().toUpperCase();
  return v ? v : null;
}

export async function fetchVisitorCountry() {
  try {
    const res = await fetch('/api/geo', { method: 'GET' });
    if (!res.ok) return null;
    const data = await res.json();
    const c = data?.country ? String(data.country).trim().toUpperCase() : null;
    if (c) localStorage.setItem(STORAGE_KEY, c);
    return c || null;
  } catch {
    return null;
  }
}


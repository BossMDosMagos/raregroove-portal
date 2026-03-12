import { signHeaders } from './_b2sigv4.js';
import { getSupabaseEnv, requireAdmin } from './_supabaseAuth.js';

async function sha256Hex(message) {
  const msgUint8 = typeof message === 'string' ? new TextEncoder().encode(message) : message;
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet(context) {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv(context.env);
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: 'missing_supabase_env' }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }

  const authorization = context.request.headers.get('authorization') || '';
  const admin = await requireAdmin({ supabaseUrl, supabaseAnonKey, authorization });
  if (!admin.ok) {
    return new Response(JSON.stringify({ error: admin.error }), { status: admin.status, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }

  const endpointHost = String(context.env.B2_ENDPOINT || '').trim().replace(/^https?:\/\//, '');
  const bucket = String(context.env.B2_BUCKET_NAME || '').trim();
  const region = String(context.env.B2_REGION || '').trim();
  const accessKeyId = String(context.env.B2_KEY_ID || '').trim();
  const secretAccessKey = String(context.env.B2_APPLICATION_KEY || '').trim();
  if (!endpointHost || !bucket || !region || !accessKeyId || !secretAccessKey) {
    return new Response(JSON.stringify({ error: 'missing_b2_env' }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }

  const url = new URL(context.request.url);
  const prefix = String(url.searchParams.get('prefix') || '').replace(/^\/+/, '');
  const maxKeys = Math.min(1000, Math.max(1, Number(url.searchParams.get('max') || 200)));

  const query = new URLSearchParams();
  query.set('list-type', '2');
  query.set('max-keys', String(maxKeys));
  if (prefix) query.set('prefix', prefix);

  const pathWithQuery = `/${encodeURIComponent(bucket)}?${query.toString()}`;
  const payloadHash = await sha256Hex('');

  const headers = await signHeaders({
    endpointHost,
    method: 'GET',
    pathWithQuery,
    region,
    accessKeyId,
    secretAccessKey,
    payloadHash,
    extraHeaders: {},
  });

  const res = await fetch(`https://${endpointHost}${pathWithQuery}`, { method: 'GET', headers });
  const text = await res.text();
  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'b2_error', status: res.status, body: text }), { status: 502, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }

  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const contents = Array.from(doc.querySelectorAll('Contents')).map((n) => ({
    key: n.querySelector('Key')?.textContent || '',
    size: Number(n.querySelector('Size')?.textContent || 0),
    lastModified: n.querySelector('LastModified')?.textContent || '',
    etag: (n.querySelector('ETag')?.textContent || '').replace(/"/g, ''),
  })).filter((x) => x.key);

  return new Response(JSON.stringify({ objects: contents }), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

import { signHeaders } from '../_b2sigv4.js';
import { requireAdmin } from '../_supabaseAuth.js';

function encodeKeyPath(key) {
  return String(key || '').split('/').map((s) => encodeURIComponent(s)).join('/');
}

async function sha256Hex(message) {
  const msgUint8 = typeof message === 'string' ? new TextEncoder().encode(message) : message;
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context) {
  const supabaseUrl = String(context.env.SUPABASE_URL || '').trim();
  const supabaseAnonKey = String(context.env.SUPABASE_ANON_KEY || '').trim();
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

  const body = await context.request.json().catch(() => ({}));
  const key = String(body?.key || '').trim().replace(/^\/+/, '');
  const uploadId = String(body?.upload_id || '').trim();
  const parts = Array.isArray(body?.parts) ? body.parts : [];

  if (!key) return new Response(JSON.stringify({ error: 'missing_key' }), { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' } });
  if (!uploadId) return new Response(JSON.stringify({ error: 'missing_upload_id' }), { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' } });
  if (parts.length === 0) return new Response(JSON.stringify({ error: 'missing_parts' }), { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' } });

  const normalized = parts
    .map((p) => ({
      partNumber: Number(p?.partNumber || p?.part_number || 0),
      etag: String(p?.etag || p?.ETag || '').replace(/"/g, ''),
    }))
    .filter((p) => Number.isFinite(p.partNumber) && p.partNumber > 0 && p.etag);

  if (normalized.length === 0) return new Response(JSON.stringify({ error: 'invalid_parts' }), { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' } });

  normalized.sort((a, b) => a.partNumber - b.partNumber);
  const partsXml = normalized.map((p) => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>"${p.etag}"</ETag></Part>`).join('');
  const xml = `<CompleteMultipartUpload xmlns="http://s3.amazonaws.com/doc/2006-03-01/">${partsXml}</CompleteMultipartUpload>`;
  const payloadHash = await sha256Hex(xml);

  const pathWithQuery = `/${encodeURIComponent(bucket)}/${encodeKeyPath(key)}?uploadId=${encodeURIComponent(uploadId)}`;

  const headers = await signHeaders({
    endpointHost,
    method: 'POST',
    pathWithQuery,
    region,
    accessKeyId,
    secretAccessKey,
    payloadHash,
    extraHeaders: { 'content-type': 'application/xml' },
  });

  const res = await fetch(`https://${endpointHost}${pathWithQuery}`, {
    method: 'POST',
    headers,
    body: xml,
  });

  const text = await res.text();
  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'b2_error', status: res.status, body: text }), { status: 502, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}


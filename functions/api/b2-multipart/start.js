import { signHeaders } from '../_b2sigv4.js';
import { getSupabaseEnv, requireAdmin } from '../_supabaseAuth.js';

function encodeKeyPath(key) {
  return String(key || '').split('/').map((s) => encodeURIComponent(s)).join('/');
}

async function sha256Hex(message) {
  const msgUint8 = typeof message === 'string' ? new TextEncoder().encode(message) : message;
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function extractUploadId(xml) {
  const m = String(xml || '').match(/<UploadId>([\s\S]*?)<\/UploadId>/i);
  return m ? String(m[1] || '').trim() : '';
}

export async function onRequestPost(context) {
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

  const body = await context.request.json().catch(() => ({}));
  const key = String(body?.key || '').trim().replace(/^\/+/, '');
  if (!key) {
    return new Response(JSON.stringify({ error: 'missing_key' }), { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }

  const pathWithQuery = `/${encodeURIComponent(bucket)}/${encodeKeyPath(key)}?uploads`;
  const payloadHash = await sha256Hex('');

  const headers = await signHeaders({
    endpointHost,
    method: 'POST',
    pathWithQuery,
    region,
    accessKeyId,
    secretAccessKey,
    payloadHash,
    extraHeaders: {},
  });

  const res = await fetch(`https://${endpointHost}${pathWithQuery}`, {
    method: 'POST',
    headers,
  });

  const text = await res.text();
  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'b2_error', status: res.status, body: text }), { status: 502, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }

  const uploadId = extractUploadId(text);
  if (!uploadId) {
    return new Response(JSON.stringify({ error: 'missing_upload_id' }), { status: 502, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }

  return new Response(JSON.stringify({ upload_id: uploadId }), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

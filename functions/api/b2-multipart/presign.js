import { presignUrl } from '../_b2sigv4.js';
import { requireAdmin } from '../_supabaseAuth.js';

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
  const partNumber = Number(body?.part_number || 0);

  if (!key) return new Response(JSON.stringify({ error: 'missing_key' }), { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' } });
  if (!uploadId) return new Response(JSON.stringify({ error: 'missing_upload_id' }), { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' } });
  if (!Number.isFinite(partNumber) || partNumber <= 0) return new Response(JSON.stringify({ error: 'invalid_part_number' }), { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' } });

  const url = await presignUrl({
    endpointHost,
    method: 'PUT',
    bucket,
    key,
    region,
    accessKeyId,
    secretAccessKey,
    expiresSeconds: 7200,
    extraQuery: {
      uploadId,
      partNumber: String(partNumber),
    },
    unsignedPayload: true,
  });

  return new Response(JSON.stringify({ url }), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}


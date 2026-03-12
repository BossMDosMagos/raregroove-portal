import { presignUrl } from './_b2sigv4.js';
import { getSupabaseUserFromRequest, getProfileRow } from './_supabaseAuth.js';

async function supabaseGetUser({ supabaseUrl, supabaseAnonKey, bearer }) {
  return await getSupabaseUserFromRequest({ supabaseUrl, supabaseAnonKey, authorization: bearer });
}

async function supabaseGetProfile({ supabaseUrl, supabaseAnonKey, bearer, userId }) {
  return await getProfileRow({
    supabaseUrl,
    supabaseAnonKey,
    authorization: bearer,
    userId,
    select: 'id,user_level,subscription_status,subscription_trial_ends_at,subscription_data_used_gb',
  });
}

async function supabaseGetSettings({ supabaseUrl, supabaseAnonKey, bearer }) {
  const url = new URL(`${supabaseUrl}/rest/v1/subscription_settings`);
  url.searchParams.set('select', 'trial_data_limit_gb');
  url.searchParams.set('order', 'created_at.asc');
  url.searchParams.set('limit', '1');

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: bearer,
    }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function supabaseIncrementTrialUsage({ supabaseUrl, supabaseAnonKey, bearer, deltaGb }) {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/increment_trial_usage`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: bearer,
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ delta_gb: deltaGb }),
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function onRequestPost(context) {
  const supabaseUrl = String(context.env.SUPABASE_URL || '').trim();
  const supabaseAnonKey = String(context.env.SUPABASE_ANON_KEY || '').trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: 'missing_supabase_env' }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }

  const bearer = context.request.headers.get('authorization') || '';
  if (!bearer.toLowerCase().startsWith('bearer ')) {
    return new Response(JSON.stringify({ error: 'missing_auth' }), { status: 401, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }

  const user = await supabaseGetUser({ supabaseUrl, supabaseAnonKey, bearer });
  if (!user?.id) {
    return new Response(JSON.stringify({ error: 'invalid_auth' }), { status: 401, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }

  const body = await context.request.json().catch(() => ({}));
  const filePath = String(body?.file_path || body?.path || '').trim().replace(/^\/+/, '');
  const mode = String(body?.mode || 'stream').toLowerCase();

  if (!filePath) {
    return new Response(JSON.stringify({ error: 'missing_file_path' }), { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }

  const profile = await supabaseGetProfile({ supabaseUrl, supabaseAnonKey, bearer, userId: user.id });
  if (!profile?.id) {
    return new Response(JSON.stringify({ error: 'missing_profile' }), { status: 403, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }

  const status = String(profile.subscription_status || 'inactive').toLowerCase();
  const userLevel = Number(profile.user_level || 0);

  const settings = await supabaseGetSettings({ supabaseUrl, supabaseAnonKey, bearer });
  const trialLimitGb = Number(settings?.trial_data_limit_gb || 0);
  const usedGb = Number(profile.subscription_data_used_gb || 0);
  const trialEndsAtMs = profile.subscription_trial_ends_at ? new Date(profile.subscription_trial_ends_at).getTime() : 0;

  const nowMs = Date.now();
  const trialValid = status === 'trialing' && trialEndsAtMs > nowMs && (trialLimitGb <= 0 || usedGb < trialLimitGb);
  const activeValid = status === 'active';

  if (!(activeValid || trialValid)) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }

  if (mode === 'download' && !(activeValid && userLevel >= 2)) {
    return new Response(JSON.stringify({ error: 'forbidden_download' }), { status: 403, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }

  const endpointHost = String(context.env.B2_ENDPOINT || '').trim().replace(/^https?:\/\//, '');
  const bucket = String(context.env.B2_BUCKET_NAME || '').trim();
  const region = String(context.env.B2_REGION || '').trim();
  const accessKeyId = String(context.env.B2_KEY_ID || '').trim();
  const secretAccessKey = String(context.env.B2_APPLICATION_KEY || '').trim();

  if (!endpointHost || !bucket || !region || !accessKeyId || !secretAccessKey) {
    return new Response(JSON.stringify({ error: 'missing_b2_env' }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }

  const filename = body?.filename ? String(body.filename) : null;
  const responseContentDisposition = mode === 'download'
    ? `attachment${filename ? `; filename="${filename.replace(/"/g, '')}"` : ''}`
    : null;

  const extraQuery = {};
  if (responseContentDisposition) extraQuery['response-content-disposition'] = responseContentDisposition;

  const url = await presignUrl({
    endpointHost,
    method: 'GET',
    bucket,
    key: filePath,
    region,
    accessKeyId,
    secretAccessKey,
    expiresSeconds: 7200,
    extraQuery,
    unsignedPayload: true,
  });

  if (status === 'trialing') {
    try {
      const head = await fetch(url, { method: 'HEAD' });
      const len = head.headers.get('content-length');
      const bytes = len ? Number(len) : 0;
      if (Number.isFinite(bytes) && bytes > 0) {
        const deltaGb = bytes / (1024 * 1024 * 1024);
        const metered = await supabaseIncrementTrialUsage({ supabaseUrl, supabaseAnonKey, bearer, deltaGb });
        if (String(metered?.status || '').toLowerCase() === 'expired') {
          return new Response(JSON.stringify({ error: 'trial_expired' }), { status: 403, headers: { 'content-type': 'application/json; charset=utf-8' } });
        }
      }
    } catch (e) {
      void e;
    }
  }

  return new Response(
    JSON.stringify({ url }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store'
      }
    }
  );
}

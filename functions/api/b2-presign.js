function toAmzDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

function toDateStamp(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function encodeRfc3986(str) {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodePath(path) {
  const cleaned = String(path || '').replace(/^\/+/, '');
  if (!cleaned) return '';
  return cleaned.split('/').map(encodeRfc3986).join('/');
}

async function sha256Hex(message) {
  const msgUint8 = typeof message === 'string' ? new TextEncoder().encode(message) : message;
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(keyBytes, message) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

async function getSigningKey(secretAccessKey, dateStamp, region, service) {
  const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${secretAccessKey}`), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  return kSigning;
}

function buildQueryString(params) {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => [encodeRfc3986(k), encodeRfc3986(String(v))]);
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  return entries.map(([k, v]) => `${k}=${v}`).join('&');
}

async function presignGetUrl({
  endpointHost,
  bucket,
  key,
  region,
  accessKeyId,
  secretAccessKey,
  expiresSeconds,
  responseContentDisposition,
  responseContentType,
}) {
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = toDateStamp(now);
  const service = 's3';
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credential = `${accessKeyId}/${scope}`;
  const canonicalUri = `/${encodeRfc3986(bucket)}/${encodePath(key)}`;

  const queryParams = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': 'host',
  };

  if (responseContentDisposition) queryParams['response-content-disposition'] = responseContentDisposition;
  if (responseContentType) queryParams['response-content-type'] = responseContentType;

  const canonicalQueryString = buildQueryString(queryParams);
  const canonicalHeaders = `host:${endpointHost}\n`;
  const signedHeaders = 'host';
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    'GET',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = await getSigningKey(secretAccessKey, dateStamp, region, service);
  const signatureBytes = await hmacSha256(signingKey, stringToSign);
  const signatureHex = [...signatureBytes].map((b) => b.toString(16).padStart(2, '0')).join('');

  const finalQueryString = `${canonicalQueryString}&X-Amz-Signature=${signatureHex}`;
  return `https://${endpointHost}${canonicalUri}?${finalQueryString}`;
}

async function supabaseGetUser({ supabaseUrl, supabaseAnonKey, bearer }) {
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: bearer,
    }
  });
  if (!res.ok) return null;
  return await res.json();
}

async function supabaseGetProfile({ supabaseUrl, supabaseAnonKey, bearer, userId }) {
  const url = new URL(`${supabaseUrl}/rest/v1/profiles`);
  url.searchParams.set('select', 'id,user_level,subscription_status,subscription_trial_ends_at,subscription_data_used_gb');
  url.searchParams.set('id', `eq.${userId}`);

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

  const url = await presignGetUrl({
    endpointHost,
    bucket,
    key: filePath,
    region,
    accessKeyId,
    secretAccessKey,
    expiresSeconds: 7200,
    responseContentDisposition,
    responseContentType: null,
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

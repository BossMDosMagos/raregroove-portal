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

export async function presignUrl({
  endpointHost,
  method,
  bucket,
  key,
  region,
  accessKeyId,
  secretAccessKey,
  expiresSeconds,
  extraQuery = {},
  unsignedPayload = true,
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
    ...extraQuery,
  };

  const canonicalQueryString = buildQueryString(queryParams);
  const canonicalHeaders = `host:${endpointHost}\n`;
  const signedHeaders = 'host';
  const payloadHash = unsignedPayload ? 'UNSIGNED-PAYLOAD' : await sha256Hex('');

  const canonicalRequest = [
    String(method || 'GET').toUpperCase(),
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

export async function signHeaders({
  endpointHost,
  method,
  pathWithQuery,
  region,
  accessKeyId,
  secretAccessKey,
  payloadHash,
  extraHeaders = {},
}) {
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = toDateStamp(now);
  const service = 's3';
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;

  const headersLower = {
    host: endpointHost,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
  };

  Object.entries(extraHeaders || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    headersLower[String(k).toLowerCase()] = String(v);
  });

  const signedHeaderKeys = Object.keys(headersLower).sort();
  const canonicalHeaders = signedHeaderKeys.map((k) => `${k}:${headersLower[k].trim()}\n`).join('');
  const signedHeaders = signedHeaderKeys.join(';');

  const url = new URL(`https://${endpointHost}${pathWithQuery}`);
  const canonicalUri = url.pathname;
  const queryEntries = [];
  url.searchParams.forEach((v, k) => queryEntries.push([k, v]));
  queryEntries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  const canonicalQueryString = queryEntries.map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`).join('&');

  const canonicalRequest = [
    String(method || 'GET').toUpperCase(),
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

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;

  const finalHeaders = {
    ...Object.fromEntries(Object.entries(headersLower).map(([k, v]) => [k, v])),
    authorization,
  };

  return finalHeaders;
}


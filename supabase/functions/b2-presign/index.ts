// Supabase Edge Function para streaming de áudio via Backblaze B2
// Pre-assina URLs do B2 para streaming/download com verificação de permissões (admin bypass)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const B2_ENDPOINT = Deno.env.get('B2_ENDPOINT') || '';
const B2_BUCKET_NAME = Deno.env.get('B2_BUCKET_NAME') || '';
const B2_REGION = Deno.env.get('B2_REGION') || '';
const B2_KEY_ID = Deno.env.get('B2_KEY_ID') || '';
const B2_APPLICATION_KEY = Deno.env.get('B2_APPLICATION_KEY') || '';

function getSupabaseClient(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false }
  });
}

async function checkStreamingPermission(supabase: any, userId: string): Promise<{ allowed: boolean; isAdmin: boolean; reason?: string }> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, user_level, subscription_status, subscription_trial_ends_at, subscription_data_used_gb, is_admin')
    .eq('id', userId)
    .single();
  
  if (error || !profile) {
    console.error('[B2-Presign] Erro ao buscar perfil:', error);
    return { allowed: false, isAdmin: false, reason: 'Perfil não encontrado' };
  }
  
  if (profile.is_admin) {
    console.log('[B2-Presign] Admin bypass para user:', userId);
    return { allowed: true, isAdmin: true };
  }
  
  const status = profile.subscription_status?.toLowerCase() || 'inactive';
  const userLevel = Number(profile.user_level || 0);
  const trialEndsAtMs = profile.subscription_trial_ends_at ? new Date(profile.subscription_trial_ends_at).getTime() : 0;
  const nowMs = Date.now();
  
  if (status === 'active' && userLevel >= 1) {
    return { allowed: true, isAdmin: false };
  }
  
  const trialValid = status === 'trialing' && trialEndsAtMs > nowMs;
  if (trialValid && userLevel >= 1) {
    return { allowed: true, isAdmin: false };
  }
  
  return { allowed: false, isAdmin: false, reason: 'Assinatura ativa requerida para streaming' };
}

async function getSignedUrl(filePath: string, expiresSeconds: number = 7200): Promise<string> {
  let keyId = B2_KEY_ID.trim();
  let appKey = B2_APPLICATION_KEY.trim();
  
  // Verificar se as chaves são Base64 e decodificar se necessário
  try {
    const keyIdDecoded = atob(keyId);
    if (keyIdDecoded && keyIdDecoded.length > 10 && keyIdDecoded.includes(':')) {
      keyId = keyIdDecoded.split(':')[0];
      appKey = keyIdDecoded.split(':')[1] || appKey;
      console.log('[B2-Presign] Credenciais decodificadas de Base64');
    }
  } catch {
    // Não é Base64, usar texto puro
  }
  
  const b2Auth = await getB2Auth(keyId, appKey);
  if (!b2Auth) throw new Error('B2 não configurado ou auth falhou');

  const authorization = b2Auth;
  
  const bucketsUrl = `https://api.backblazeb2.com/b2api/v2/b2_list_buckets`;
  const bucketsRes = await fetch(bucketsUrl, {
    headers: { 'Authorization': authorization }
  });
  const bucketsData = await bucketsRes.json();
  
  const bucket = bucketsData.buckets?.find((b: any) => b.bucketName === B2_BUCKET_NAME);
  if (!bucket) throw new Error('Bucket não encontrado');
  
  const downloadUrl = `https://${bucket.bucketId}.${B2_ENDPOINT}/${filePath}`;
  
  const timestamp = Math.floor(Date.now() / 1000) + expiresSeconds;
  const expires = timestamp.toString();
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appKey),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  
  const signatureData = `GET\n${downloadUrl.split('://')[1]}\n${expires}`;
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureData));
  const signatureHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${downloadUrl}?Authorization=${keyId}:${signatureHex}&expires=${expires}`;
}

async function getB2Auth(keyId: string, appKey: string): Promise<string | null> {
  if (!keyId || !appKey) {
    console.error('[B2-Presign] Credenciais B2 faltando:', { hasKeyId: !!keyId, hasAppKey: !!appKey });
    return null;
  }

  const credentials = `${keyId}:${appKey}`;
  const encoded = btoa(credentials);
  
  console.log('[B2-Presign] Tentando auth B2 com keyId prefix:', keyId.substring(0, 5));
  
  const response = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${encoded}`,
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[B2-Presign] B2 auth falhou:', response.status, errText);
    return null;
  }

  const data = await response.json();
  console.log('[B2-Presign] B2 auth OK, accountId:', data.accountId);
  return `Bearer ${data.apiInfo.accountInfo.buckets[0]?.bucketId || data.authorizationToken}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient(req);
    if (!supabase) {
      return new Response(JSON.stringify({ error: 'missing_auth' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'invalid_auth' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verificar permissões de streaming
    const permission = await checkStreamingPermission(supabase, user.id);
    console.log('[B2-Presign] Permissão:', { userId: user.id, ...permission });
    
    if (!permission.allowed) {
      return new Response(JSON.stringify({ error: permission.reason || 'forbidden' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, user_level, subscription_status, subscription_trial_ends_at, subscription_data_used_gb')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: 'missing_profile' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const body = await req.json().catch(() => ({}));
    const filePath = String(body?.file_path || body?.path || '').trim().replace(/^\/+/, '');
    const mode = String(body?.mode || 'stream').toLowerCase();

    if (!filePath) {
      return new Response(JSON.stringify({ error: 'missing_file_path' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_NAME) {
      console.error('[B2-Presign] B2 não configurado:', { B2_KEY_ID: !!B2_KEY_ID, B2_BUCKET_NAME: !!B2_BUCKET_NAME });
      return new Response(JSON.stringify({ error: 'b2_not_configured' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Admin bypass para downloads
    const status = profile.subscription_status?.toLowerCase() || 'inactive';
    const userLevel = Number(profile.user_level || 0);
    const activeValid = status === 'active';
    
    if (mode === 'download' && !permission.isAdmin && !(activeValid && userLevel >= 2)) {
      return new Response(JSON.stringify({ error: 'forbidden_download' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const url = await getSignedUrl(filePath, 7200);

    return new Response(
      JSON.stringify({ url }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );

  } catch (error) {
    console.error('[B2-Presign] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
})

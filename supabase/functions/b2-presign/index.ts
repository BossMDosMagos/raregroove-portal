// Supabase Edge Function para streaming de áudio via Backblaze B2
// Pre-assina URLs do B2 para streaming/download

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configurações B2 (via Secrets do Supabase)
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

async function getSignedUrl(filePath: string, expiresSeconds: number = 7200): Promise<string> {
  // Gerar URL pré-assinada usando API do B2
  const b2Auth = await getB2Auth();
  if (!b2Auth) throw new Error('B2 não configurado');

  const authorization = b2Auth;
  
  // Lista de buckets para encontrar o bucket correto
  const bucketsUrl = `https://api.backblazeb2.com/b2api/v2/b2_list_buckets`;
  const bucketsRes = await fetch(bucketsUrl, {
    headers: { 'Authorization': authorization }
  });
  const bucketsData = await bucketsRes.json();
  
  // Encontrar bucket pelo nome
  const bucket = bucketsData.buckets?.find((b: any) => b.bucketName === B2_BUCKET_NAME);
  if (!bucket) throw new Error('Bucket não encontrado');
  
  // Obter URL de download
  const downloadUrl = `https://${bucket.bucketId}.${B2_ENDPOINT}/${filePath}`;
  
  // Gerar URL pré-assinada
  const timestamp = Math.floor(Date.now() / 1000) + expiresSeconds;
  const expires = timestamp.toString();
  
  // Assinatura HMAC-SHA1
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(B2_APPLICATION_KEY),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  
  const signatureData = `GET\n${downloadUrl.split('://')[1]}\n${expires}`;
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureData));
  const signatureHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${downloadUrl}?Authorization=${B2_KEY_ID}:${signatureHex}&expires=${expires}`;
}

async function getB2Auth(): Promise<string | null> {
  if (!B2_KEY_ID || !B2_APPLICATION_KEY) {
    return null;
  }

  const credentials = `${B2_KEY_ID}:${B2_APPLICATION_KEY}`;
  const encoded = btoa(credentials);
  
  const response = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${encoded}`,
    }
  });

  if (!response.ok) {
    console.error('B2 auth failed:', await response.text());
    return null;
  }

  const data = await response.json();
  return `Bearer ${data.apiInfo.accountInfo.buckets[0]?.bucketId || data.authorizationToken}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const supabase = getSupabaseClient(req);
    if (!supabase) {
      return new Response(JSON.stringify({ error: 'missing_auth' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verificar usuário
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'invalid_auth' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verificar perfil e assinatura
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, user_level, subscription_status, subscription_trial_ends_at, subscription_data_used_gb')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'missing_profile' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verificar status da assinatura
    const status = profile.subscription_status?.toLowerCase() || 'inactive';
    const userLevel = Number(profile.user_level || 0);
    const trialEndsAtMs = profile.subscription_trial_ends_at ? new Date(profile.subscription_trial_ends_at).getTime() : 0;
    const nowMs = Date.now();
    
    const trialValid = status === 'trialing' && trialEndsAtMs > nowMs;
    const activeValid = status === 'active';

    if (!(activeValid || trialValid)) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Parsear body
    const body = await req.json().catch(() => ({}));
    const filePath = String(body?.file_path || body?.path || '').trim().replace(/^\/+/, '');
    const mode = String(body?.mode || 'stream').toLowerCase();

    if (!filePath) {
      return new Response(JSON.stringify({ error: 'missing_file_path' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verificar B2 configurado
    if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_NAME) {
      console.error('B2 não configurado:', { B2_KEY_ID: !!B2_KEY_ID, B2_BUCKET_NAME: !!B2_BUCKET_NAME });
      return new Response(JSON.stringify({ error: 'b2_not_configured' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verificar se modo download é permitido (apenas para Keeper+)
    if (mode === 'download' && !(activeValid && userLevel >= 2)) {
      return new Response(JSON.stringify({ error: 'forbidden_download' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Gerar URL pré-assinada
    const url = await getSignedUrl(filePath, 7200);

    // Trial usage metering (simplificado)
    if (status === 'trialing' && mode === 'stream') {
      try {
        // Aqui você pode adicionar lógica para rastrear uso do trial
        // via RPC increment_trial_usage se necessário
      } catch (e) {
        console.warn('Trial metering error:', e);
      }
    }

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
    console.error('B2 Presign Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
})

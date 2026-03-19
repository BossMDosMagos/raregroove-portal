// Supabase Edge Function - Upload para Backblaze B2
// Upload direto para B2 com verificação de permissões (admin bypass)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const B2_KEY_ID = Deno.env.get('B2_KEY_ID') || '';
const B2_APPLICATION_KEY = Deno.env.get('B2_APPLICATION_KEY') || '';
const B2_BUCKET_NAME = Deno.env.get('B2_BUCKET_NAME') || '';
const B2_REGION = Deno.env.get('B2_REGION') || 'us-east-005';

function getSupabaseClient(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false }
  });
}

function getServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  return createClient(supabaseUrl, serviceRoleKey);
}

async function checkUploadPermission(userId: string): Promise<{ allowed: boolean; isAdmin: boolean; reason?: string }> {
  const supabaseAdmin = getServiceClient();
  
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('is_admin, subscription_status, user_level')
    .eq('id', userId)
    .single();
  
  console.log('[B2-Upload] Profile query result:', { userId, profile, error });
  
  if (error || !profile) {
    console.error('[B2-Upload] Erro ao buscar perfil:', error);
    return { allowed: false, isAdmin: false, reason: 'Perfil não encontrado' };
  }
  
  if (profile.is_admin === true) {
    console.log('[B2-Upload] ADMIN BYPASS - upload permitido');
    return { allowed: true, isAdmin: true };
  }
  
  const status = profile.subscription_status?.toLowerCase();
  const userLevel = Number(profile.user_level || 0);
  
  if (status === 'active' && userLevel >= 1) {
    return { allowed: true, isAdmin: false };
  }
  
  return { allowed: false, isAdmin: false, reason: 'Assinatura ativa requerida para upload' };
}

serve(async (req) => {
  console.log('[B2-Upload] === Nova requisição ===');
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const supabase = getSupabaseClient(req);
    if (!supabase) {
      return new Response(JSON.stringify({ error: 'missing_auth' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'invalid_auth' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verificar permissões de upload
    const permission = await checkUploadPermission(user.id);
    console.log('[B2-Upload] Permissão:', { userId: user.id, ...permission });
    
    if (!permission.allowed) {
      return new Response(JSON.stringify({ error: permission.reason || 'upload_forbidden' }), { 
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verificar B2 configurado
    if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_NAME) {
      console.error('[B2-Upload] B2 não configurado:', { 
        hasKeyId: !!B2_KEY_ID, 
        hasAppKey: !!B2_APPLICATION_KEY, 
        hasBucket: !!B2_BUCKET_NAME 
      });
      return new Response(JSON.stringify({ error: 'B2 não configurado' }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Autenticar com B2 usando Basic Auth
    // Converter de Base64 se necessário, caso contrário texto puro
    let keyId = B2_KEY_ID.trim();
    let appKey = B2_APPLICATION_KEY.trim();
    
    // Verificar se as chaves parecem ser Base64 e decodificar
    try {
      const keyIdDecoded = atob(keyId);
      if (keyIdDecoded && keyIdDecoded.length > 10) {
        keyId = keyIdDecoded;
        console.log('[B2-Upload] KeyId decodificado de Base64');
      }
    } catch {
      // Não é Base64, usar texto puro
    }
    
    try {
      const appKeyDecoded = atob(appKey);
      if (appKeyDecoded && appKeyDecoded.length > 10) {
        appKey = appKeyDecoded;
        console.log('[B2-Upload] AppKey decodificado de Base64');
      }
    } catch {
      // Não é Base64, usar texto puro
    }
    
    console.log('[B2-Upload] Credenciais B2:', { 
      keyIdLength: keyId.length, 
      keyIdPrefix: keyId.substring(0, 5),
      isAdmin: permission.isAdmin 
    });
    
    const authString = `${keyId}:${appKey}`;
    const encoded = btoa(authString);
    
    const authRes = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      method: 'POST',
      headers: { 
        'Authorization': `Basic ${encoded}`,
        'Content-Type': 'application/json'
      }
    });

    if (!authRes.ok) {
      const err = await authRes.text();
      console.error('[B2-Upload] B2 auth falhou:', authRes.status, err);
      return new Response(JSON.stringify({ 
        error: 'B2 auth failed', 
        status: authRes.status, 
        details: err,
        debug: { keyIdLength: keyId.length, isBase64: B2_KEY_ID !== keyId }
      }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const authData = await authRes.json();
    console.log('[B2-Upload] B2 auth OK, accountId:', authData.accountId);

    // Obter body
    const body = await req.json().catch(() => ({}));
    const { filename, category, contentType } = body;

    if (!filename || !category) {
      return new Response(JSON.stringify({ error: 'filename e category obrigatórios' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Buscar bucket ID
    const bucketRes = await fetch(`https://api.backblazeb2.com/b2api/v2/b2_list_buckets?accountId=${authData.accountId}`, {
      headers: { 'Authorization': authData.authorizationToken }
    });
    
    const bucketData = await bucketRes.json();
    console.log('Buckets found:', bucketData.buckets?.map((b: any) => b.bucketName));
    
    const bucket = bucketData.buckets?.find((b: any) => b.bucketName === B2_BUCKET_NAME);
    if (!bucket) {
      console.log('Bucket not found:', B2_BUCKET_NAME);
      return new Response(JSON.stringify({ error: `Bucket ${B2_BUCKET_NAME} não encontrado` }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    console.log('Bucket found:', bucket.bucketName, bucket.bucketId);

    // Obter URL de upload
    const uploadUrlRes = await fetch(`https://api.backblazeb2.com/b2api/v2/b2_get_upload_url?bucketId=${bucket.bucketId}`, {
      headers: { 'Authorization': authData.authorizationToken }
    });
    
    const uploadUrlData = await uploadUrlRes.json();
    
    if (!uploadUrlData.uploadUrl) {
      console.log('Failed to get upload URL:', uploadUrlData);
      return new Response(JSON.stringify({ error: 'Falha ao obter URL de upload', details: uploadUrlData }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Gerar path do arquivo
    const timestamp = Date.now();
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `grooveflix/test/${category}/${timestamp}_${safeFilename}`;

    console.log('Success! uploadUrl:', uploadUrlData.uploadUrl.substring(0, 50) + '...');
    console.log('filePath:', filePath);

    return new Response(
      JSON.stringify({
        uploadUrl: uploadUrlData.uploadUrl,
        uploadAuthToken: uploadUrlData.authorizationToken,
        filePath: filePath,
        contentType: contentType || 'application/octet-stream'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})

// Supabase Edge Function - Upload para Backblaze B2
// Upload direto para B2 - Admin bypass total via service role

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

function getServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, serviceRoleKey);
}

async function getUserFromToken(token: string): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    
    // Usar serviço de autenticação diretamente
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': serviceRoleKey,
      }
    });
    
    if (!response.ok) {
      console.log('[B2-Upload] Falha ao validar token:', response.status);
      return null;
    }
    
    const userData = await response.json();
    return userData?.id || null;
  } catch (err) {
    console.error('[B2-Upload] Erro ao validar token:', err);
    return null;
  }
}

async function checkIsAdmin(userId: string): Promise<boolean> {
  try {
    const supabaseAdmin = getServiceClient();
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single();
    
    if (error || !data) {
      console.error('[B2-Upload] Erro ao buscar perfil:', error);
      return false;
    }
    
    return data.is_admin === true;
  } catch (err) {
    console.error('[B2-Upload] Erro checkIsAdmin:', err);
    return false;
  }
}

async function authorizeUpload(token: string): Promise<{ allowed: boolean; userId?: string; reason?: string }> {
  const userId = await getUserFromToken(token);
  
  if (!userId) {
    return { allowed: false, reason: 'Token inválido ou expirado' };
  }
  
  const isAdmin = await checkIsAdmin(userId);
  
  if (isAdmin) {
    console.log('[B2-Upload] ADMIN AUTORIZADO:', userId);
    return { allowed: true, userId };
  }
  
  return { allowed: false, reason: 'Apenas admins podem fazer upload' };
}

serve(async (req) => {
  console.log('[B2-Upload] === Nova requisição ===');
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'missing_auth' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Autorizar upload
    const auth = await authorizeUpload(token);
    
    if (!auth.allowed) {
      return new Response(JSON.stringify({ error: auth.reason }), { 
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const userId = auth.userId!;
    console.log('[B2-Upload] Upload autorizado para:', userId);

    // Verificar B2 configurado
    if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_NAME) {
      console.error('[B2-Upload] B2 não configurado');
      return new Response(JSON.stringify({ error: 'B2 não configurado' }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Autenticar com B2
    const authString = `${B2_KEY_ID}:${B2_APPLICATION_KEY}`;
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
      return new Response(JSON.stringify({ error: 'B2 auth failed', details: err }), { 
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
    const bucket = bucketData.buckets?.find((b: any) => b.bucketName === B2_BUCKET_NAME);
    
    if (!bucket) {
      return new Response(JSON.stringify({ error: `Bucket ${B2_BUCKET_NAME} não encontrado` }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Obter URL de upload
    const uploadUrlRes = await fetch(`https://api.backblazeb2.com/b2api/v2/b2_get_upload_url?bucketId=${bucket.bucketId}`, {
      headers: { 'Authorization': authData.authorizationToken }
    });
    
    const uploadUrlData = await uploadUrlRes.json();
    
    if (!uploadUrlData.uploadUrl) {
      return new Response(JSON.stringify({ error: 'Falha ao obter URL de upload' }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Gerar path do arquivo
    const timestamp = Date.now();
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `grooveflix/${category}/${timestamp}_${safeFilename}`;

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
    console.error('[B2-Upload] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})

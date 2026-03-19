// Supabase Edge Function - Upload para Backblaze B2
// Admin bypass total via service role - sem dependência de JWT do usuário

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

async function checkIsAdmin(userId: string): Promise<{ isAdmin: boolean; reason?: string }> {
  try {
    const supabaseAdmin = getServiceClient();
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('is_admin, subscription_status')
      .eq('id', userId)
      .single();
    
    if (error || !data) {
      console.error('[B2-Upload] Erro ao buscar perfil:', error);
      return { isAdmin: false, reason: 'Perfil não encontrado' };
    }
    
    if (data.is_admin === true) {
      console.log('[B2-Upload] ADMIN VERIFICADO:', userId);
      return { isAdmin: true };
    }
    
    return { isAdmin: false, reason: 'Apenas admins podem fazer upload' };
  } catch (err) {
    console.error('[B2-Upload] Erro checkIsAdmin:', err);
    return { isAdmin: false, reason: 'Erro interno ao verificar permissões' };
  }
}

serve(async (req) => {
  console.log('[B2-Upload] === Nova requisição ===');
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse body
    const body = await req.json().catch(() => ({}));
    const { filename, category, contentType, userId } = body;

    if (!filename || !category) {
      return new Response(JSON.stringify({ error: 'filename e category obrigatórios' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId obrigatório' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verificar se é admin via service role (bypass total de RLS)
    const adminCheck = await checkIsAdmin(userId);
    
    if (!adminCheck.isAdmin) {
      console.log('[B2-Upload] Acesso negado para:', userId, adminCheck.reason);
      return new Response(JSON.stringify({ error: adminCheck.reason }), { 
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('[B2-Upload] Upload autorizado para admin:', userId);

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

    console.log('[B2-Upload] Sucesso! filePath:', filePath);

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

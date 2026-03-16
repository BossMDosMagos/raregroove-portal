// Direct Upload to B2 - com validação manual de JWT

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

// Valida o token JWT do Supabase manualmente
async function validateSupabaseToken(req: Request) {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    return { valid: false, error: 'No authorization header' };
  }
  
  // Extrair o token
  let token = authHeader;
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.substring(7);
  }
  
  if (!token) {
    return { valid: false, error: 'No token' };
  }
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  
  if (!supabaseUrl || !supabaseAnonKey) {
    return { valid: false, error: 'No Supabase config' };
  }
  
  // Criar cliente e verificar token
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false }
  });
  
  const { data, error } = await supabase.auth.getUser();
  
  if (error || !data?.user) {
    return { valid: false, error: error?.message || 'Invalid token', user: null };
  }
  
  return { valid: true, user: data.user, error: null };
}

serve(async (req) => {
  console.log('=== b2-upload-url called ===');
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validar token do Supabase
    const tokenValidation = await validateSupabaseToken(req);
    console.log('Token validation:', tokenValidation.valid ? 'OK' : tokenValidation.error);
    
    if (!tokenValidation.valid) {
      return new Response(JSON.stringify({ error: 'Unauthorized', message: tokenValidation.error }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verificar B2
    if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_NAME) {
      console.log('B2 not configured');
      return new Response(JSON.stringify({ error: 'B2 não configurado' }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Autenticar com B2
    const credentials = `${B2_KEY_ID}:${B2_APPLICATION_KEY}`;
    const encoded = btoa(credentials);
    
    const authRes = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      method: 'POST',
      headers: { 
        'Authorization': `Basic ${encoded}`,
        'Content-Type': 'application/json'
      }
    });

    if (!authRes.ok) {
      const err = await authRes.text();
      console.log('B2 auth failed:', err);
      return new Response(JSON.stringify({ error: 'B2 auth failed', details: err }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const authData = await authRes.json();
    console.log('B2 auth OK');

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
      console.log('Bucket not found:', B2_BUCKET_NAME);
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
      console.log('Failed to get upload URL');
      return new Response(JSON.stringify({ error: 'Falha ao obter URL de upload' }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Gerar path do arquivo
    const timestamp = Date.now();
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const userId = tokenValidation.user?.id || 'anon';
    const filePath = `grooveflix/${userId}/${category}/${timestamp}_${safeFilename}`;

    console.log('Success! Path:', filePath);

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

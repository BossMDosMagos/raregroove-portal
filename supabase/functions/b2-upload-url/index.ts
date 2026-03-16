// Direct Upload to B2 - Edge Function simplificada

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const B2_KEY_ID = Deno.env.get('B2_KEY_ID') || '';
const B2_APPLICATION_KEY = Deno.env.get('B2_APPLICATION_KEY') || '';
const B2_BUCKET_NAME = Deno.env.get('B2_BUCKET_NAME') || '';

serve(async (req) => {
  console.log('=== b2-upload-url called ===');
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar credenciais B2
    if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_NAME) {
      console.log('B2 not configured');
      return new Response(JSON.stringify({ 
        error: 'B2 não configurado no servidor' 
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Obter body
    const body = await req.json().catch(() => ({}));
    const { filename, category, userId } = body;

    console.log('Request:', { filename, category, userId });

    if (!filename || !category) {
      return new Response(JSON.stringify({ 
        error: 'Parâmetros obrigatórios: filename, category' 
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Autenticar com B2
    const credentials = `${B2_KEY_ID}:${B2_APPLICATION_KEY}`;
    const encoded = btoa(credentials);
    
    const authRes = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${encoded}` }
    });

    if (!authRes.ok) {
      const err = await authRes.text();
      console.log('B2 auth failed:', err);
      return new Response(JSON.stringify({ 
        error: 'Falha na autenticação B2' 
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const authData = await authRes.json();
    console.log('B2 auth OK');

    // Buscar bucket
    const bucketsRes = await fetch('https://api.backblazeb2.com/b2api/v2/b2_list_buckets', {
      headers: { 'Authorization': authData.authorizationToken }
    });
    const bucketsData = await bucketsRes.json();
    
    const bucket = bucketsData.buckets?.find((b: any) => b.bucketName === B2_BUCKET_NAME);
    if (!bucket) {
      console.log('Bucket not found:', B2_BUCKET_NAME);
      return new Response(JSON.stringify({ 
        error: `Bucket ${B2_BUCKET_NAME} não encontrado` 
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Obter URL de upload
    const uploadUrlRes = await fetch(`https://api.backblazeb2.com/b2api/v2/b2_get_upload_url?bucketId=${bucket.bucketId}`, {
      headers: { 'Authorization': authData.authorizationToken }
    });
    
    const uploadUrlData = await uploadUrlRes.json();
    if (!uploadUrlData.uploadUrl) {
      console.log('Failed to get upload URL');
      return new Response(JSON.stringify({ 
        error: 'Falha ao obter URL de upload' 
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Gerar path
    const timestamp = Date.now();
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `grooveflix/${userId || 'anon'}/${category}/${timestamp}_${safeFilename}`;

    console.log('Success! Path:', filePath);

    return new Response(
      JSON.stringify({
        uploadUrl: uploadUrlData.uploadUrl,
        uploadAuthToken: uploadUrlData.authorizationToken,
        filePath: filePath,
        bucketId: bucket.bucketId
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

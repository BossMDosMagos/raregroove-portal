// Direct Upload to B2 - SEM verificação de JWT (apenas para teste)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const B2_KEY_ID = Deno.env.get('B2_KEY_ID') || '';
const B2_APPLICATION_KEY = Deno.env.get('B2_APPLICATION_KEY') || '';
const B2_BUCKET_NAME = Deno.env.get('B2_BUCKET_NAME') || '';
const B2_REGION = Deno.env.get('B2_REGION') || 'us-east-005';

serve(async (req) => {
  console.log('=== b2-upload-url called ===');
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // SEM verificação de JWT - apenas fala com B2

    // Verificar B2
    if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_NAME) {
      console.log('B2 not configured');
      return new Response(JSON.stringify({ error: 'B2 não configurado' }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Autenticar com B2 usando Basic Auth
    const authString = `${B2_KEY_ID}:${B2_APPLICATION_KEY}`;
    const encoded = btoa(authString);
    
    console.log('Auth string (first 20):', authString.substring(0, 20) + '...');
    
    const authRes = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      method: 'POST',
      headers: { 
        'Authorization': `Basic ${encoded}`,
        'Content-Type': 'application/json'
      }
    });

    if (!authRes.ok) {
      const err = await authRes.text();
      console.log('B2 auth failed:', authRes.status, err);
      return new Response(JSON.stringify({ error: 'B2 auth failed', status: authRes.status, details: err }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const authData = await authRes.json();
    console.log('B2 auth OK, accountId:', authData.accountId);

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

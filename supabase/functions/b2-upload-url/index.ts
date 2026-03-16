// Edge Function para upload para Backblaze B2
// Versão simplificada para debug

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

console.log('B2 Config:', { 
  B2_KEY_ID: B2_KEY_ID ? 'SET' : 'MISSING',
  B2_APPLICATION_KEY: B2_APPLICATION_KEY ? 'SET' : 'MISSING', 
  B2_BUCKET_NAME 
});

function getSupabaseClient(req: Request) {
  // Tentar obter o token do header Authorization
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  console.log('Auth header:', authHeader ? 'Present' : 'Missing');
  
  if (!authHeader) {
    console.log('No auth header found');
    return null;
  }
  
  // Se começar com Bearer, usar como token
  let token = authHeader;
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.substring(7);
  }
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  
  console.log('Supabase URL:', supabaseUrl ? 'Present' : 'Missing');
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.log('Missing Supabase config');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false }
  });
}

async function getB2Auth() {
  if (!B2_KEY_ID || !B2_APPLICATION_KEY) {
    console.error('B2 credentials missing');
    return null;
  }
  
  const credentials = `${B2_KEY_ID}:${B2_APPLICATION_KEY}`;
  const encoded = btoa(credentials);
  
  console.log('Authenticating with B2...');
  
  const response = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${encoded}` }
  });

  if (!response.ok) {
    console.error('B2 auth failed:', response.status, await response.text());
    return null;
  }
  const data = await response.json();
  console.log('B2 auth success');
  return data;
}

async function getUploadUrl(bucketId: string, authToken: string) {
  const response = await fetch(`https://api.backblazeb2.com/b2api/v2/b2_get_upload_url?bucketId=${bucketId}`, {
    headers: { 'Authorization': authToken }
  });
  
  if (!response.ok) {
    console.error('Get upload URL failed:', response.status, await response.text());
    return null;
  }
  return await response.json();
}

// Validar tipo de arquivo
function validateFileType(filename: string, category: string): string | null {
  const ext = filename.toLowerCase().split('.').pop();
  
  const validations: Record<string, string[]> = {
    audio: ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac'],
    preview: ['mp3', 'flac', 'ogg', 'm4a', 'aac'],
    iso: ['iso', 'bin', 'img'],
    booklet: ['pdf'],
    cover: ['jpg', 'jpeg', 'png', 'webp', 'gif']
  };
  
  const allowed = validations[category];
  if (!allowed) return null;
  if (!ext || !allowed.includes(ext)) {
    return `Extensão .${ext} não permitida para ${category}`;
  }
  return null;
}

serve(async (req) => {
  console.log('=== b2-upload-url called ===');
  console.log('Method:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar autenticação do Supabase
    const supabase = getSupabaseClient(req);
    if (!supabase) {
      console.log('Returning 401: No supabase client');
      return new Response(JSON.stringify({ 
        error: 'missing_auth', 
        message: 'Token de autenticação não encontrado. Faça login novamente.' 
      }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verificar usuário
    let user = null;
    try {
      const { data, error } = await supabase.auth.getUser();
      user = data?.user;
      console.log('User:', user?.id || 'Not found', error?.message || '');
    } catch (e) {
      console.log('Auth error:', e.message);
    }
    
    if (!user) {
      console.log('Returning 401: No user');
      return new Response(JSON.stringify({ 
        error: 'invalid_auth', 
        message: 'Sessão expirada ou inválida. Faça login novamente.' 
      }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('User authenticated:', user.id);

    // Verificar B2
    if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_NAME) {
      console.log('Returning 500: B2 not configured');
      return new Response(JSON.stringify({ 
        error: 'b2_not_configured', 
        message: 'B2 não configurado no servidor' 
      }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const body = await req.json().catch(() => ({}));
    const { filename, category, fileSize } = body;

    console.log('Request:', { filename, category, fileSize });

    if (!filename || !category) {
      return new Response(JSON.stringify({ 
        error: 'missing_params', 
        message: 'Parâmetros filename e category são obrigatórios' 
      }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Validar tipo
    const validationError = validateFileType(filename, category);
    if (validationError) {
      return new Response(JSON.stringify({ 
        error: 'invalid_file_type', 
        message: validationError 
      }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Obter autorização B2
    const b2Auth = await getB2Auth();
    if (!b2Auth) {
      return new Response(JSON.stringify({ 
        error: 'b2_auth_failed', 
        message: 'Falha ao autenticar com B2. Verifique as credenciais.' 
      }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Encontrar bucket
    const bucketsRes = await fetch('https://api.backblazeb2.com/b2api/v2/b2_list_buckets', {
      headers: { 'Authorization': b2Auth.authorizationToken }
    });
    const bucketsData = await bucketsRes.json();
    
    if (!bucketsData.buckets) {
      console.log('Bucket error:', bucketsData);
      return new Response(JSON.stringify({ 
        error: 'bucket_error', 
        message: 'Erro ao buscar buckets' 
      }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    const bucket = bucketsData.buckets.find((b: any) => b.bucketName === B2_BUCKET_NAME);
    
    if (!bucket) {
      console.log('Bucket not found:', B2_BUCKET_NAME, 'Available:', bucketsData.buckets.map((b: any) => b.bucketName));
      return new Response(JSON.stringify({ 
        error: 'bucket_not_found', 
        message: `Bucket ${B2_BUCKET_NAME} não encontrado` 
      }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Obter URL de upload
    const uploadUrlData = await getUploadUrl(bucket.bucketId, b2Auth.authorizationToken);
    if (!uploadUrlData) {
      return new Response(JSON.stringify({ 
        error: 'upload_url_failed', 
        message: 'Falha ao obter URL de upload' 
      }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Gerar path
    const timestamp = Date.now();
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `grooveflix/${user.id}/${category}/${timestamp}_${safeFilename}`;

    console.log('Success! Returning upload URL for:', filePath);

    return new Response(
      JSON.stringify({
        uploadUrl: uploadUrlData.uploadUrl,
        uploadAuthToken: uploadUrlData.authorizationToken,
        filePath: filePath,
        bucketId: bucket.bucketId
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'internal_error', message: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})

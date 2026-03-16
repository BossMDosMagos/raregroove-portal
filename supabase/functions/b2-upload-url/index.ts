// Edge Function para gerar URL de upload para Backblaze B2
// Retorna URL pré-assinada para upload direto do cliente

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
  if (!authHeader?.startsWith('Bearer ')) return null;
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false }
  });
}

async function getB2Auth() {
  const credentials = `${B2_KEY_ID}:${B2_APPLICATION_KEY}`;
  const encoded = btoa(credentials);
  
  const response = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${encoded}` }
  });

  if (!response.ok) {
    console.error('B2 auth failed:', response.status, await response.text());
    return null;
  }
  const data = await response.json();
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
  if (!allowed) {
    return `Categoria desconhecida: ${category}`;
  }
  if (!ext || !allowed.includes(ext)) {
    return `Extensão .${ext || 'unknown'} não permitida para ${category}. Allowed: ${allowed.join(', ')}`;
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const supabase = getSupabaseClient(req);
    if (!supabase) {
      return new Response(JSON.stringify({ error: 'missing_auth', message: 'Faça login para fazer upload' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'invalid_auth', message: 'Sessão expirada' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verificar perfil e assinatura - COMENTADO PARA TESTES
    // const { data: profile } = await supabase
    //   .from('profiles')
    //   .select('id, user_level, subscription_status')
    //   .eq('id', user.id)
    //   .single();
    // const status = profile?.subscription_status?.toLowerCase() || 'inactive';
    // if (status !== 'active' && status !== 'trialing') {
    //   return new Response(JSON.stringify({ error: 'no_subscription', message: 'Assinatura necessária' }), { 
    //     status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    //   });
    // }

    // Verificar B2 configurado
    if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_NAME) {
      console.error('B2 not configured:', { B2_KEY_ID: !!B2_KEY_ID, B2_APPLICATION_KEY: !!B2_APPLICATION_KEY, B2_BUCKET_NAME: !!B2_BUCKET_NAME });
      return new Response(JSON.stringify({ error: 'b2_not_configured', message: 'B2 não configurado no servidor' }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const body = await req.json().catch(() => ({}));
    const { filename, category, fileSize } = body;

    console.log('Upload request:', { filename, category, fileSize });

    if (!filename || !category) {
      return new Response(JSON.stringify({ error: 'missing_params', message: 'Parâmetros filename e category são obrigatórios' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Validar tipo de arquivo
    const validationError = validateFileType(filename, category);
    if (validationError) {
      return new Response(JSON.stringify({ error: 'invalid_file_type', message: validationError }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Validar tamanho (800MB max)
    if (fileSize && fileSize > 800 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'file_too_large', message: 'Arquivo muito grande. Máximo: 800MB' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Obter autorização B2
    const b2Auth = await getB2Auth();
    if (!b2Auth) {
      return new Response(JSON.stringify({ error: 'b2_auth_failed', message: 'Falha ao autenticar com B2' }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Encontrar bucket ID
    const bucketsRes = await fetch('https://api.backblazeb2.com/b2api/v2/b2_list_buckets', {
      headers: { 'Authorization': b2Auth.authorizationToken }
    });
    const bucketsData = await bucketsRes.json();
    
    if (!bucketsData.buckets) {
      console.error('No buckets found:', bucketsData);
      return new Response(JSON.stringify({ error: 'bucket_error', message: 'Erro ao buscar buckets' }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    const bucket = bucketsData.buckets.find((b: any) => b.bucketName === B2_BUCKET_NAME);
    
    if (!bucket) {
      console.error('Bucket not found:', B2_BUCKET_NAME, 'Available:', bucketsData.buckets.map((b: any) => b.bucketName));
      return new Response(JSON.stringify({ error: 'bucket_not_found', message: `Bucket ${B2_BUCKET_NAME} não encontrado` }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Obter URL de upload
    const uploadUrlData = await getUploadUrl(bucket.bucketId, b2Auth.authorizationToken);
    if (!uploadUrlData) {
      return new Response(JSON.stringify({ error: 'upload_url_failed', message: 'Falha ao obter URL de upload' }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Gerar path do arquivo
    const timestamp = Date.now();
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `grooveflix/${user.id}/${category}/${timestamp}_${safeFilename}`;

    console.log('Returning upload URL for:', filePath);

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
    console.error('B2 Upload URL Error:', error);
    return new Response(
      JSON.stringify({ error: 'internal_error', message: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})

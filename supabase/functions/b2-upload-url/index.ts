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

// Obter token de autorização do B2
async function getB2Auth() {
  const credentials = `${B2_KEY_ID}:${B2_APPLICATION_KEY}`;
  const encoded = btoa(credentials);
  
  const response = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${encoded}` }
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data;
}

// Obter URL de upload
async function getUploadUrl(bucketId: string, authToken: string) {
  const response = await fetch(`https://api.backblazeb2.com/b2api/v2/b2_get_upload_url?bucketId=${bucketId}`, {
    headers: { 'Authorization': authToken }
  });
  
  if (!response.ok) return null;
  return await response.json();
}

// Validar tipo de arquivo
function validateFileType(filename: string, category: string): string | null {
  const ext = filename.toLowerCase().split('.').pop();
  
  const validations = {
    audio: ['mp3', 'flac', 'wav', 'ogg', 'm4a'],
    preview: ['mp3', 'flac', 'ogg', 'm4a'],
    iso: ['iso', 'bin'],
    booklet: ['pdf']
  };
  
  const allowed = validations[category];
  if (!allowed) return null;
  if (!ext || !allowed.includes(ext)) {
    return `Extensão .${ext} não permitida para ${category}. Allowed: ${allowed.join(', ')}`;
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

    // Verificar perfil e assinatura
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, user_level, subscription_status')
      .eq('id', user.id)
      .single();

    const status = profile?.subscription_status?.toLowerCase() || 'inactive';
    if (status !== 'active' && status !== 'trialing') {
      return new Response(JSON.stringify({ error: 'no_subscription' }), { 
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verificar B2 configurado
    if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_NAME) {
      return new Response(JSON.stringify({ error: 'b2_not_configured' }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const body = await req.json();
    const { filename, category, fileSize } = body;

    if (!filename || !category) {
      return new Response(JSON.stringify({ error: 'missing_params' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Validar tipo de arquivo
    const validationError = validateFileType(filename, category);
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Validar tamanho (500MB max)
    if (fileSize && fileSize > 500 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'file_too_large' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Obter autorização B2
    const b2Auth = await getB2Auth();
    if (!b2Auth) {
      return new Response(JSON.stringify({ error: 'b2_auth_failed' }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Encontrar bucket ID
    const bucketsRes = await fetch('https://api.backblazeb2.com/b2api/v2/b2_list_buckets', {
      headers: { 'Authorization': b2Auth.authorizationToken }
    });
    const bucketsData = await bucketsRes.json();
    const bucket = bucketsData.buckets?.find((b: any) => b.bucketName === B2_BUCKET_NAME);
    
    if (!bucket) {
      return new Response(JSON.stringify({ error: 'bucket_not_found' }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Obter URL de upload
    const uploadUrlData = await getUploadUrl(bucket.bucketId, b2Auth.authorizationToken);
    if (!uploadUrlData) {
      return new Response(JSON.stringify({ error: 'upload_url_failed' }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Gerar path do arquivo
    const timestamp = Date.now();
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `grooveflix/${user.id}/${category}/${timestamp}_${safeFilename}`;

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
      JSON.stringify({ error: error.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})

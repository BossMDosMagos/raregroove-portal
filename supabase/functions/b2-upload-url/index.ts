// Supabase Edge Function - Upload para Backblaze B2
// Admin bypass total via service role

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
      return { isAdmin: false, reason: 'Perfil não encontrado' };
    }
    
    if (data.is_admin === true) {
      return { isAdmin: true };
    }
    
    return { isAdmin: false, reason: 'Apenas admins podem fazer upload' };
  } catch {
    return { isAdmin: false, reason: 'Erro interno ao verificar permissões' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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

    const adminCheck = await checkIsAdmin(userId);
    
    if (!adminCheck.isAdmin) {
      return new Response(JSON.stringify({ error: adminCheck.reason }), { 
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_NAME) {
      return new Response(JSON.stringify({ error: 'B2 não configurado' }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // B2 Authorization
    const authString = B2_KEY_ID + ':' + B2_APPLICATION_KEY;
    const encoded = btoa(authString);
    
    const authRes = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      method: 'POST',
      headers: { 
        'Authorization': 'Basic ' + encoded,
        'Content-Type': 'application/json'
      },
      body: '{}'
    });

    if (!authRes.ok) {
      const err = await authRes.text();
      return new Response(JSON.stringify({ error: 'B2 auth failed', details: err }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const authData = await authRes.json();
    const apiUrl = authData.apiUrl; // Use the URL from auth response

    // Get upload URL directly using bucket name
    const uploadUrlRes = await fetch(apiUrl + '/b2api/v2/b2_get_upload_url', {
      method: 'POST',
      headers: { 
        'Authorization': authData.authorizationToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ bucketId: '56cfb33d8ba45a4391cf0517' }) // Use known bucket ID
    });
    
    const uploadUrlData = await uploadUrlRes.json();
    
    if (!uploadUrlData.uploadUrl) {
      return new Response(JSON.stringify({ error: 'Falha ao obter URL de upload', debug: uploadUrlData }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Generate file path
    const timestamp = Date.now();
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = 'grooveflix/' + category + '/' + timestamp + '_' + safeFilename;

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
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})

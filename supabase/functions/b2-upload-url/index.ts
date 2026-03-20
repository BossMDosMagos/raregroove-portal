// Supabase Edge Function - Upload completo para Backblaze B2
// Faz upload server-side para evitar CORS

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const B2_KEY_ID = Deno.env.get('B2_KEY_ID') || '0056f3db4a31f570000000002';
const B2_APPLICATION_KEY = Deno.env.get('B2_APPLICATION_KEY') || 'K005n2NHKFxbs/Y8Yinyklp3we5FPmE';
const B2_BUCKET_NAME = Deno.env.get('B2_BUCKET_NAME') || 'Cofre-RareGroove-01';
const B2_BUCKET_ID = Deno.env.get('B2_BUCKET_ID') || '56cfb33d8ba45a4391cf0517';
const B2_DOWNLOAD_URL = Deno.env.get('B2_DOWNLOAD_URL') || 'https://s3.us-east-005.backblazeb2.com';

function getServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, serviceRoleKey);
}

async function checkIsAdmin(userId: string): Promise<{ isAdmin: boolean }> {
  try {
    const supabaseAdmin = getServiceClient();
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single();
    return { isAdmin: data?.is_admin === true };
  } catch {
    return { isAdmin: false };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Support both JSON metadata and multipart form data
    let filename: string, category: string, userId: string, fileData: ArrayBuffer;
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      filename = formData.get('filename') as string;
      category = formData.get('category') as string;
      userId = formData.get('userId') as string;
      const file = formData.get('file') as File;
      if (file) {
        fileData = await file.arrayBuffer();
      } else {
        throw new Error('Arquivo não enviado');
      }
    } else {
      const body = await req.json();
      filename = body.filename;
      category = body.category;
      userId = body.userId;
      fileData = null;
    }

    if (!filename || !category || !userId) {
      return new Response(JSON.stringify({ error: 'filename, category e userId obrigatórios' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const adminCheck = await checkIsAdmin(userId);
    if (!adminCheck.isAdmin) {
      return new Response(JSON.stringify({ error: 'Apenas admins podem fazer upload' }), { 
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (!B2_KEY_ID || !B2_APPLICATION_KEY) {
      return new Response(JSON.stringify({ error: 'B2 não configurado' }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // B2 Authorization
    const encoded = btoa(B2_KEY_ID + ':' + B2_APPLICATION_KEY);
    const authRes = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + encoded, 'Content-Type': 'application/json' },
      body: '{}'
    });

    if (!authRes.ok) {
      return new Response(JSON.stringify({ error: 'B2 auth failed' }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const authData = await authRes.json();

    // Get upload URL
    const uploadUrlRes = await fetch(`${authData.apiUrl}/b2api/v2/b2_get_upload_url`, {
      method: 'POST',
      headers: { 'Authorization': authData.authorizationToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucketId: B2_BUCKET_ID })
    });

    if (!uploadUrlRes.ok) {
      return new Response(JSON.stringify({ error: 'Falha ao obter URL de upload' }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const uploadUrlData = await uploadUrlRes.json();

    // Generate file path
    const timestamp = Date.now();
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = 'grooveflix/' + category + '/' + timestamp + '_' + safeFilename;

    // If file data not in request, return upload URL for client-side upload
    if (!fileData) {
      return new Response(
        JSON.stringify({
          uploadUrl: uploadUrlData.uploadUrl,
          uploadAuthToken: uploadUrlData.authorizationToken,
          filePath: filePath,
          note: 'Upload file directly to uploadUrl with POST'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Server-side upload
    const uploadRes = await fetch(uploadUrlData.uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': uploadUrlData.authorizationToken,
        'X-Bz-File-Name': filePath,
        'Content-Type': 'b2/x-auto',
        'X-Bz-Content-Sha1': 'do_not_verify'
      },
      body: fileData
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      return new Response(JSON.stringify({ error: 'Upload failed', details: err }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const result = await uploadRes.json();

    return new Response(
      JSON.stringify({
        success: true,
        fileId: result.fileId,
        fileName: result.fileName,
        filePath: filePath,
        downloadUrl: `${B2_DOWNLOAD_URL}/file/${B2_BUCKET_NAME}/${filePath}`
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

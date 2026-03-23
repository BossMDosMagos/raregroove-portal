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

function getServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, serviceRoleKey);
}

async function checkUserAccess(userId: string): Promise<{ isAdmin: boolean; userLevel: number }> {
  try {
    const supabaseAdmin = getServiceClient();
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('is_admin, user_level')
      .eq('id', userId)
      .single();
    return { 
      isAdmin: data?.is_admin === true,
      userLevel: Number(data?.user_level || 0)
    };
  } catch {
    return { isAdmin: false, userLevel: 0 };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let filename: string, category: string, userId: string, itemId: string, fileData: ArrayBuffer;
    let discNumber: string | undefined;
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      filename = formData.get('filename') as string;
      category = formData.get('category') as string;
      userId = formData.get('userId') as string;
      itemId = formData.get('itemId') as string;
      discNumber = formData.get('discNumber') as string || undefined;
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
      itemId = body.itemId;
      fileData = null;
    }

    if (!filename || !category || !userId || !itemId) {
      return new Response(JSON.stringify({ 
        error: 'filename, category, userId e itemId são obrigatórios' 
      }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const access = await checkUserAccess(userId);
    if (!access.isAdmin) {
      return new Response(JSON.stringify({ error: 'Apenas admins podem fazer upload' }), { 
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (!B2_KEY_ID || !B2_APPLICATION_KEY) {
      return new Response(JSON.stringify({ error: 'B2 não configurado' }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

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

    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeItemId = itemId.replace(/[^a-zA-Z0-9-]/g, '_');
    const safeCategory = category.replace(/[^a-zA-Z0-9]/g, '_');
    const safeUserId = userId.replace(/[^a-zA-Z0-9-]/g, '_');
    
    let filePath: string;
    if (category === 'audio' && discNumber) {
      const safeDisc = `CD${discNumber}`;
      filePath = `albums/${safeItemId}/${safeDisc}/${safeFilename}`;
    } else {
      filePath = `user_${safeUserId}/${safeCategory}/${safeItemId}/${safeFilename}`;
    }

    if (!fileData) {
      return new Response(
        JSON.stringify({
          uploadUrl: uploadUrlData.uploadUrl,
          uploadAuthToken: uploadUrlData.authorizationToken,
          filePath: filePath,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
        downloadUrl: `https://f005.backblazeb2.com/file/${B2_BUCKET_NAME}/${filePath}`
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

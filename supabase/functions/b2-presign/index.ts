import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const B2_KEY_ID = Deno.env.get('B2_KEY_ID') || '0056f3db4a31f570000000002';
const B2_APPLICATION_KEY = Deno.env.get('B2_APPLICATION_KEY') || 'K005n2NHKFxbs/Y8Yinyklp3we5FPmE';
const BUCKET_NAME = 'Cofre-RareGroove-01';
const BUCKET_ID = '56cfb33d8ba45a4391cf0517';
const B2_NATIVE_URL = 'https://f005.backblazeb2.com';

function getServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function b2Auth() {
  const encoded = btoa(B2_KEY_ID + ':' + B2_APPLICATION_KEY);
  const res = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + encoded, 'Content-Type': 'application/json' },
    body: '{}'
  });
  if (!res.ok) throw new Error('B2 auth failed: ' + res.status);
  return res.json();
}

async function b2GetDownloadAuth(apiUrl: string, authToken: string) {
  const res = await fetch(`${apiUrl}/b2api/v2/b2_get_download_authorization`, {
    method: 'POST',
    headers: { 'Authorization': authToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bucketId: BUCKET_ID,
      fileNamePrefix: '',
      validDurationInSeconds: 3600
    })
  });
  if (!res.ok) throw new Error('b2_get_download_authorization failed: ' + res.status);
  return res.json();
}

async function checkAccess(userId: string): Promise<{ allowed: boolean; isAdmin: boolean; userLevel: number }> {
  if (!userId) return { allowed: false, isAdmin: false, userLevel: 0 };
  try {
    const supabaseAdmin = getServiceClient();
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('is_admin, subscription_status, user_level')
      .eq('id', userId)
      .single();
    
    if (!data) return { allowed: false, isAdmin: false, userLevel: 0 };
    
    const isAdmin = data.is_admin === true;
    const userLevel = Number(data.user_level || 0);
    
    if (isAdmin) return { allowed: true, isAdmin, userLevel };
    if (userLevel >= 999) return { allowed: true, isAdmin, userLevel };
    if (data.subscription_status === 'active' && userLevel >= 1) return { allowed: true, isAdmin, userLevel };
    
    return { allowed: false, isAdmin, userLevel };
  } catch {
    return { allowed: false, isAdmin: false, userLevel: 0 };
  }
}

async function getItemOwner(supabaseAdmin: ReturnType<typeof createClient>, itemId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from('items')
      .select('seller_id')
      .eq('id', itemId)
      .single();
    return data?.seller_id || null;
  } catch {
    return null;
  }
}

function extractUserIdFromPath(filePath: string): string | null {
  const match = filePath.match(/^user_([^/]+)\//);
  return match ? match[1] : null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const filePath = String(body?.file_path || '').trim().replace(/^\/+/, '');
    const userId = String(body?.userId || body?.user_id || '').trim();
    const fileType = String(body?.type || 'audio');
    
    console.log('[B2-PRESIGN] Request:', { filePath, userId, fileType });

    if (!filePath) {
      return new Response(JSON.stringify({ error: 'missing_file_path' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const isCover = fileType === 'cover';
    const supabaseAdmin = getServiceClient();

    if (isCover) {
      const downloadUrl = `${B2_NATIVE_URL}/file/${BUCKET_NAME}/${encodeURIComponent(filePath)}`;
      return new Response(
        JSON.stringify({ 
          url: downloadUrl,
          expiresIn: 3600,
          storage: 'b2_native',
          public: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'missing_userId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const access = await checkAccess(userId);
    if (!access.allowed) {
      return new Response(JSON.stringify({ error: 'Acesso negado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const pathOwnerId = extractUserIdFromPath(filePath);
    if (pathOwnerId && pathOwnerId !== userId && !access.isAdmin && access.userLevel < 999) {
      console.log('[B2-PRESIGN] Access denied - user:', userId, 'owner:', pathOwnerId);
      return new Response(JSON.stringify({ error: 'Acesso negado - você não é o dono deste arquivo' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const authData = await b2Auth();
    const downloadAuth = await b2GetDownloadAuth(authData.apiUrl, authData.authorizationToken);

    const safeFilePath = filePath.split('/').map(p => encodeURIComponent(p)).join('/');
    const downloadUrl = `${B2_NATIVE_URL}/file/${BUCKET_NAME}/${safeFilePath}?Authorization=${downloadAuth.authorizationToken}`;

    console.log('[B2-PRESIGN] Generated URL for user:', userId);

    return new Response(
      JSON.stringify({ 
        url: downloadUrl,
        expiresIn: downloadAuth.validDurationInSeconds,
        storage: 'b2_native'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[B2-PRESIGN] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})

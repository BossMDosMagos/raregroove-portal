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
const B2_BUCKET_NAME = Deno.env.get('B2_BUCKET_NAME') || 'Cofre-RareGroove-01';
const B2_BUCKET_ID = Deno.env.get('B2_BUCKET_ID') || '56cfb33d8ba45a4391cf0517';
const B2_DOWNLOAD_URL = Deno.env.get('B2_DOWNLOAD_URL') || 'https://s3.us-east-005.backblazeb2.com';

function getServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function checkAccess(userId: string): Promise<{ allowed: boolean; isAdmin: boolean }> {
  if (!userId) return { allowed: false, isAdmin: false };
  try {
    const supabaseAdmin = getServiceClient();
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('is_admin, subscription_status, user_level')
      .eq('id', userId)
      .single();
    
    console.log('[B2-PRESIGN] Profile data:', { data, error });
    
    if (error || !data) return { allowed: false, isAdmin: false };
    
    const userLevel = Number(data.user_level || 0);
    const status = String(data.subscription_status || 'inactive').toLowerCase();
    
    console.log('[B2-PRESIGN] User check:', { isAdmin: data.is_admin, userLevel, status });
    
    if (data.is_admin) return { allowed: true, isAdmin: true };
    
    if (userLevel >= 999) return { allowed: true, isAdmin: false };
    
    if (status === 'active' && userLevel >= 1) return { allowed: true, isAdmin: false };
    
    return { allowed: false, isAdmin: false };
  } catch (e) {
    console.error('[B2-PRESIGN] CheckAccess error:', e);
    return { allowed: false, isAdmin: false };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const filePath = String(body?.file_path || body?.path || '').trim().replace(/^\/+/, '');
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

    if (!isCover) {
      if (!userId) {
        return new Response(JSON.stringify({ error: 'missing_userId' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const access = await checkAccess(userId);
      console.log('[B2-PRESIGN] Access check result:', access);

      if (!access.allowed) {
        return new Response(JSON.stringify({ error: 'Assinatura ativa requerida', userId }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (!B2_KEY_ID || !B2_APPLICATION_KEY) {
      console.error('[B2-PRESIGN] B2 credentials not configured');
      return new Response(JSON.stringify({ error: 'B2 nao configurado' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const encoded = btoa(B2_KEY_ID + ':' + B2_APPLICATION_KEY);
    const authRes = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + encoded, 'Content-Type': 'application/json' },
      body: '{}'
    });

    if (!authRes.ok) {
      console.error('[B2-PRESIGN] B2 auth failed:', authRes.status);
      return new Response(JSON.stringify({ error: 'B2 auth failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const authData = await authRes.json();
    console.log('[B2-PRESIGN] B2 auth success, bucket:', B2_BUCKET_NAME);

    const pathParts = filePath.split('/');
    const prefix = pathParts.slice(0, Math.min(3, pathParts.length)).join('/') + '/';

    // Compensar diferença de relógio: URL válida a partir de 5 minutos no passado
    const validFromTimestamp = Math.floor(Date.now() / 1000) - 300;

    const downloadAuthRes = await fetch(`${authData.apiUrl}/b2api/v4/b2_get_download_authorization`, {
      method: 'POST',
      headers: {
        'Authorization': authData.authorizationToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bucketId: B2_BUCKET_ID,
        fileNamePrefix: prefix,
        validDurationInSeconds: 7200,
        validFromTimestamp: validFromTimestamp
      })
    });

    const bucketName = 'Cofre-RareGroove-01';
    let url: string;

    if (!downloadAuthRes.ok) {
      console.log('[B2-PRESIGN] Download auth failed, using public URL');
      url = `https://s3.us-east-005.backblazeb2.com/${bucketName}/${filePath}`;
    } else {
      const downloadAuth = await downloadAuthRes.json();
      url = `https://s3.us-east-005.backblazeb2.com/${bucketName}/${filePath}?Authorization=${downloadAuth.authorizationToken}`;
    }

    console.log('[B2-PRESIGN] Returning URL for:', filePath);

    return new Response(
      JSON.stringify({ url, expiresIn: 7200 }),
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

// Supabase Edge Function - Delete seguro para Grooveflix
// Remove arquivos do B2 E do banco de dados juntos (transação)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const B2_KEY_ID = Deno.env.get('B2_KEY_ID') || '';
const B2_APPLICATION_KEY = Deno.env.get('B2_APPLICATION_KEY') || '';

function getServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, serviceRoleKey);
}

async function getB2AuthToken(): Promise<{ authToken: string; apiUrl: string } | null> {
  if (!B2_KEY_ID || !B2_APPLICATION_KEY) return null;
  
  const encoded = btoa(B2_KEY_ID + ':' + B2_APPLICATION_KEY);
  const authRes = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + encoded, 'Content-Type': 'application/json' },
    body: '{}'
  });
  
  if (!authRes.ok) return null;
  const authData = await authRes.json();
  return { authToken: authData.authorizationToken, apiUrl: authData.apiUrl };
}

async function deleteB2File(filePath: string, auth: { authToken: string; apiUrl: string }): Promise<boolean> {
  try {
    // Primeiro, obter o fileId listando o arquivo
    const listRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_file_versions`, {
      method: 'POST',
      headers: { 'Authorization': auth.authToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bucketId: '56cfb33d8ba45a4391cf0517',
        prefix: filePath,
        maxFileCount: 1
      })
    });
    
    if (!listRes.ok) return false;
    const listData = await listRes.json();
    
    if (!listData.files || listData.files.length === 0) {
      console.log(`[B2-DELETE] File not found in bucket: ${filePath}`);
      return true; // Arquivo não existe, considera como "deletado"
    }
    
    const fileInfo = listData.files[0];
    
    // Deletar o arquivo
    const deleteRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_delete_file_version`, {
      method: 'POST',
      headers: { 
        'Authorization': auth.authToken, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        fileId: fileInfo.fileId,
        fileName: fileInfo.fileName
      })
    });
    
    if (deleteRes.ok) {
      console.log(`[B2-DELETE] Deleted: ${filePath}`);
      return true;
    }
    
    console.error(`[B2-DELETE] Failed to delete: ${filePath}`, await deleteRes.text());
    return false;
  } catch (e) {
    console.error(`[B2-DELETE] Error deleting ${filePath}:`, e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { itemId, userId } = body;

    if (!itemId) {
      return new Response(JSON.stringify({ error: 'itemId é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAdmin = getServiceClient();

    // Verificar se é admin
    if (userId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single();
      
      if (profile?.is_admin !== true) {
        return new Response(JSON.stringify({ error: 'Apenas admins podem excluir' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Buscar o item para obter os paths
    const { data: item, error: fetchError } = await supabaseAdmin
      .from('items')
      .select('id, title, metadata')
      .eq('id', itemId)
      .single();

    if (fetchError || !item) {
      return new Response(JSON.stringify({ error: 'Item não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const gf = item.metadata?.grooveflix || {};
    const filesToDelete: string[] = [];
    
    if (gf.cover_path) filesToDelete.push(gf.cover_path);
    if (gf.audio_path) filesToDelete.push(gf.audio_path);
    if (gf.preview_path) filesToDelete.push(gf.preview_path);
    if (gf.iso_path) filesToDelete.push(gf.iso_path);
    if (gf.booklet_path) filesToDelete.push(gf.booklet_path);
    if (gf.audio_files && Array.isArray(gf.audio_files)) {
      gf.audio_files.forEach(audio => {
        if (audio.path) filesToDelete.push(audio.path);
      });
    }

    // Deletar arquivos do B2
    const auth = await getB2AuthToken();
    const deletedFiles: string[] = [];
    const failedFiles: string[] = [];

    if (auth && filesToDelete.length > 0) {
      console.log(`[GROOVEFLIX-DELETE] Deleting ${filesToDelete.length} files from B2...`);
      
      for (const filePath of filesToDelete) {
        const success = await deleteB2File(filePath, auth);
        if (success) {
          deletedFiles.push(filePath);
        } else {
          failedFiles.push(filePath);
        }
      }
    }

    // Deletar do banco de dados
    const { error: deleteError } = await supabaseAdmin
      .from('items')
      .delete()
      .eq('id', itemId);

    if (deleteError) {
      return new Response(JSON.stringify({ 
        error: 'Erro ao deletar do banco',
        details: deleteError.message,
        filesDeleted: deletedFiles.length,
        filesFailed: failedFiles
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[GROOVEFLIX-DELETE] Successfully deleted item ${itemId}: ${deletedFiles.length} files from B2`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Item deletado com sucesso',
        deletedFiles: deletedFiles.length,
        failedFiles: failedFiles,
        itemTitle: item.title
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[GROOVEFLIX-DELETE] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})

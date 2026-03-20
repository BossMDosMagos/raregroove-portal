// Supabase Edge Function - Limpa registros fantasma do banco de dados
// Remove referências a arquivos que não existem mais no B2

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

async function checkFileExists(filePath: string, auth: { authToken: string; apiUrl: string }): Promise<boolean> {
  try {
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
    const data = await listRes.json();
    return data.files && data.files.length > 0 && data.files[0].fileName === filePath;
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = getServiceClient();
    const auth = await getB2AuthToken();
    
    if (!auth) {
      return new Response(JSON.stringify({ error: 'B2 não configurado' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar todos os itens com metadata grooveflix
    const { data: items, error: fetchError } = await supabaseAdmin
      .from('items')
      .select('id, title, metadata')
      .not('metadata', 'is', null)
      .filter('metadata->grooveflix', 'neq', 'null');

    if (fetchError) throw fetchError;

    const results = {
      total: items?.length || 0,
      cleaned: 0,
      errors: [] as string[],
      details: [] as { id: string; title: string; cleaned: string[] }
    };

    for (const item of items || []) {
      const gf = item.metadata?.grooveflix;
      if (!gf) continue;

      const cleaned: string[] = [];
      
      // Verificar cover_path
      if (gf.cover_path) {
        const exists = await checkFileExists(gf.cover_path, auth);
        if (!exists) {
          cleaned.push('cover_path');
        }
      }

      // Verificar audio_path
      if (gf.audio_path) {
        const exists = await checkFileExists(gf.audio_path, auth);
        if (!exists) {
          cleaned.push('audio_path');
        }
      }

      // Verificar audio_files
      if (gf.audio_files && Array.isArray(gf.audio_files)) {
        for (const audio of gf.audio_files) {
          if (audio.path) {
            const exists = await checkFileExists(audio.path, auth);
            if (!exists) {
              cleaned.push(`audio_files.${audio.name}`);
            }
          }
        }
      }

      // Verificar preview_path
      if (gf.preview_path) {
        const exists = await checkFileExists(gf.preview_path, auth);
        if (!exists) {
          cleaned.push('preview_path');
        }
      }

      // Verificar iso_path
      if (gf.iso_path) {
        const exists = await checkFileExists(gf.iso_path, auth);
        if (!exists) {
          cleaned.push('iso_path');
        }
      }

      // Se encontrou algo para limpar, atualizar o banco
      if (cleaned.length > 0) {
        const updatedMetadata = { ...item.metadata };
        updatedMetadata.grooveflix = { ...gf };

        if (cleaned.includes('cover_path')) updatedMetadata.grooveflix.cover_path = null;
        if (cleaned.includes('audio_path')) updatedMetadata.grooveflix.audio_path = null;
        if (cleaned.includes('preview_path')) updatedMetadata.grooveflix.preview_path = null;
        if (cleaned.includes('iso_path')) updatedMetadata.grooveflix.iso_path = null;
        
        // Limpar audio_files que não existem
        if (gf.audio_files && Array.isArray(gf.audio_files)) {
          updatedMetadata.grooveflix.audio_files = gf.audio_files.filter(audio => {
            return !cleaned.includes(`audio_files.${audio.name}`);
          });
        }

        const { error: updateError } = await supabaseAdmin
          .from('items')
          .update({ metadata: updatedMetadata })
          .eq('id', item.id);

        if (updateError) {
          results.errors.push(`Erro ao atualizar ${item.id}: ${updateError.message}`);
        } else {
          results.cleaned++;
          results.details.push({ id: item.id, title: item.title, cleaned });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Limpeza concluída! ${results.cleaned} registros atualizados.`,
        ...results
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

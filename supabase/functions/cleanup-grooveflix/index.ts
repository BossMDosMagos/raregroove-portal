// Supabase Edge Function - Remove itens fantasma do Grooveflix
// Deleta itens que não têm capa nem áudio

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, serviceRoleKey);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = getServiceClient();
    
    // Buscar todos os itens
    const { data: items, error: fetchError } = await supabaseAdmin
      .from('items')
      .select('id, title, metadata')
      .limit(100);

    if (fetchError) throw fetchError;

    console.log('[CLEANUP] Total items found:', items?.length);

    const toDelete: string[] = [];
    const details: { id: string; title: string; reason: string }[] = [];

    for (const item of items || []) {
      const gf = item.metadata?.grooveflix;
      
      if (!gf) {
        // Item sem grooveflix metadata - verificar se está vazio
        const hasCover = item.metadata?.cover_url || item.metadata?.image_url || item.metadata?.cover_path;
        const hasAudio = item.metadata?.audio_path || (item.metadata?.audio_files && item.metadata.audio_files.length > 0);
        const hasIso = item.metadata?.iso_path;
        
        if (!hasCover && !hasAudio && !hasIso) {
          toDelete.push(item.id);
          details.push({ 
            id: item.id, 
            title: item.title || 'Sem título', 
            reason: 'Item sem conteúdo' 
          });
        }
        continue;
      }
      
      const hasCover = gf.cover_path && gf.cover_path.length > 0;
      const hasAudio = (gf.audio_path && gf.audio_path.length > 0) || 
                       (gf.audio_files && gf.audio_files.length > 0);
      const hasIso = gf.iso_path && gf.iso_path.length > 0;
      
      // Se não tem capa, não tem áudio e não tem ISO, marcar para deletar
      if (!hasCover && !hasAudio && !hasIso) {
        toDelete.push(item.id);
        details.push({ 
          id: item.id, 
          title: item.title || 'Sem título', 
          reason: 'Grooveflix sem capa, sem áudio e sem ISO' 
        });
      }
    }

    // Deletar os itens
    let deletedCount = 0;
    const deleteErrors: string[] = [];

    if (toDelete.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from('items')
        .delete()
        .in('id', toDelete);

      if (deleteError) {
        deleteErrors.push(deleteError.message);
      } else {
        deletedCount = toDelete.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${deletedCount} itens fantasma removidos!`,
        totalScanned: items?.length || 0,
        deleted: deletedCount,
        details,
        errors: deleteErrors
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

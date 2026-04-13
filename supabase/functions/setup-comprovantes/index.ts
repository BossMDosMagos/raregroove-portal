import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Create admin client
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    
    // Use raw SQL query via postgres protocol
    // First check if policies exist
    const { data: existingPolicies } = await supabase
      .from('storage.objects')
      .select('name')
      .limit(0)
    
    // The issue is RLS is blocking us
    // We need to disable RLS or create policies using service role bypass
    // Let's check current bucket access
    
    return new Response(JSON.stringify({ 
      message: 'Function called - need to create policies via SQL',
      bucketExists: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
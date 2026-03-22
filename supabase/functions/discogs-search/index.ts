import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    })
  }

  try {
    const discogsToken = Deno.env.get('DISCOGS_PERSONAL_ACCESS_TOKEN')

    if (!discogsToken) {
      console.error('[Discogs] Missing DISCOGS_PERSONAL_ACCESS_TOKEN')
      return new Response(JSON.stringify({ data: null, error: 'Discogs token not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { query, type = 'search', releaseId, limit = 20 } = await req.json()

    const baseUrl = 'https://api.discogs.com'
    const userAgent = 'RareGroovePortal/1.0 (+https://portalraregroove.com)'

    let url = ''
    let data = null

    if (type === 'search') {
      const params = new URLSearchParams({
        q: query,
        type: 'release',
        per_page: limit.toString(),
        page: '1',
      })
      url = `${baseUrl}/database/search?${params}`
    } else if (type === 'release' && releaseId) {
      url = `${baseUrl}/releases/${releaseId}`
    } else if (type === 'master' && releaseId) {
      url = `${baseUrl}/masters/${releaseId}`
    } else if (type === 'artist' && releaseId) {
      url = `${baseUrl}/artists/${releaseId}`
    } else {
      return new Response(JSON.stringify({ data: null, error: 'Invalid request type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[Discogs] Fetching: ${type} - ${query || releaseId}`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        'Authorization': `Discogs token=${discogsToken}`,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Discogs] API error: ${response.status}`, errorText)
      return new Response(JSON.stringify({ data: null, error: `Discogs API error: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    data = await response.json()

    if (type === 'search') {
      data = data.results || []
    }

    return new Response(JSON.stringify({ data, error: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[Discogs] Error:', error)
    return new Response(JSON.stringify({ data: null, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

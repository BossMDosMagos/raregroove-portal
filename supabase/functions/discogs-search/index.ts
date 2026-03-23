import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  console.log('[Discogs] Request received:', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    
    if (url.pathname.endsWith('/image-proxy')) {
      const imageUrl = url.searchParams.get('url');
      if (!imageUrl) {
        return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[Discogs] Proxying image:', imageUrl.substring(0, 100));
      
      let imageResponse;
      try {
        imageResponse = await fetch(imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.discogs.com/',
            'Origin': 'https://portalraregroove.com',
          },
          signal: AbortSignal.timeout(10000),
        });
      } catch (fetchError) {
        console.error('[Discogs] Image fetch error:', fetchError.message);
        return new Response('Failed to fetch image', { status: 502 });
      }

      if (!imageResponse.ok) {
        console.error('[Discogs] Image fetch failed:', imageResponse.status);
        return new Response('Image not found', { status: 404 });
      }

      let imageBuffer;
      try {
        imageBuffer = await imageResponse.arrayBuffer();
      } catch (bufferError) {
        console.error('[Discogs] Buffer error:', bufferError.message);
        return new Response('Failed to read image', { status: 502 });
      }
      
      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

      return new Response(imageBuffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    const discogsToken = Deno.env.get('DISCOGS_PERSONAL_ACCESS_TOKEN')

    if (!discogsToken) {
      console.error('[Discogs] Missing token')
      return new Response(JSON.stringify({ error: 'Discogs token not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { query, type = 'search', releaseId, limit = 20 } = body

    const baseUrl = 'https://api.discogs.com'
    const userAgent = 'RareGroovePortal/1.0 (+https://portalraregroove.com)'

    let apiUrl = ''

    if (type === 'search') {
      const params = new URLSearchParams({
        q: query,
        type: 'release',
        per_page: limit.toString(),
        page: '1',
      })
      apiUrl = `${baseUrl}/database/search?${params}`
    } else if (type === 'release' && releaseId) {
      apiUrl = `${baseUrl}/releases/${releaseId}`
    } else if (type === 'master' && releaseId) {
      apiUrl = `${baseUrl}/masters/${releaseId}`
    } else if (type === 'artist' && releaseId) {
      apiUrl = `${baseUrl}/artists/${releaseId}`
    } else {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[Discogs] Fetching: ${type} - ${query || releaseId}`)

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': userAgent,
        'Authorization': `Discogs token=${discogsToken}`,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Discogs] Discogs API error: ${response.status}`, errorText)
      return new Response(JSON.stringify({ error: `Discogs error: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await response.json()
    const results = type === 'search' ? (data.results || []) : data

    console.log(`[Discogs] Success: found ${Array.isArray(results) ? results.length : 1} items`)

    return new Response(JSON.stringify({ data: results, error: null }), {
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

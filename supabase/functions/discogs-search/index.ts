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
        return new Response(JSON.stringify({ error: 'Image fetch failed' }), { 
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!imageResponse.ok) {
        console.error('[Discogs] Image fetch failed:', imageResponse.status);
        return new Response(JSON.stringify({ error: 'Image not available' }), { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let imageBuffer;
      try {
        imageBuffer = await imageResponse.arrayBuffer();
      } catch (bufferError) {
        console.error('[Discogs] Buffer error:', bufferError.message);
        return new Response(JSON.stringify({ error: 'Failed to read image' }), { 
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

      return new Response(imageBuffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
    const { query, type = 'search', releaseId, limit = 20, barcode } = body

    const baseUrl = 'https://api.discogs.com'
    const userAgent = 'RareGroovePortal/1.0 (+https://portalraregroove.com)'

    let apiUrl = ''
    let fallbackApiUrl = ''

    if (type === 'search') {
      const params = new URLSearchParams({
        q: query,
        type: 'release',
        per_page: limit.toString(),
        page: '1',
      })
      apiUrl = `${baseUrl}/database/search?${params}`
    } else if (type === 'barcode') {
      // Busca exata por código de barras (EAN/UPC). A API do Discogs aceita
      // o parâmetro `barcode` diretamente no endpoint /database/search.
      const cleanBarcode = String(barcode || '').replace(/[^0-9]/g, '')
      if (!cleanBarcode) {
        return new Response(JSON.stringify({ error: 'Invalid barcode' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const params = new URLSearchParams({
        barcode: cleanBarcode,
        type: 'release',
        per_page: limit.toString(),
        page: '1',
      })
      apiUrl = `${baseUrl}/database/search?${params}`

      // Releases recém-criadas (ex.: DVDs novos) podem ainda não aparecer na
      // busca exata por barcode. Guarda uma busca textual pelo número como
      // fallback — ela encontra DVDs e CDs que o índice de barcode não pegou.
      const textParams = new URLSearchParams({
        q: cleanBarcode,
        type: 'release',
        per_page: limit.toString(),
        page: '1',
      })
      fallbackApiUrl = `${baseUrl}/database/search?${textParams}`
    } else if (type === 'release' && releaseId) {
      apiUrl = `${baseUrl}/releases/${releaseId}`
    } else if (type === 'master' && releaseId) {
      apiUrl = `${baseUrl}/masters/${releaseId}`
    } else if (type === 'artist' && releaseId) {
      apiUrl = `${baseUrl}/artists/${releaseId}`
    } else if (type === 'price_suggestions' && releaseId) {
      apiUrl = `${baseUrl}/marketplace/price_suggestions/${releaseId}`
      console.log(`[Discogs] Price suggestions URL: ${apiUrl}`)
    } else if (type === 'release_stats' && releaseId) {
      apiUrl = `${baseUrl}/marketplace/stats/${releaseId}`
      console.log(`[Discogs] Release stats URL: ${apiUrl}`)
    } else {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[Discogs] Fetching: ${type} - ${query || releaseId || barcode}`)

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
      console.error(`[Discogs] URL was: ${apiUrl}`)
      return new Response(JSON.stringify({ error: `Discogs error: ${response.status}`, details: errorText }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let data = await response.json()
    // Tanto 'search' quanto 'barcode' usam /database/search, cuja resposta
    // contém `results`; os demais tipos retornam o objeto diretamente.
    let results = (type === 'search' || type === 'barcode') ? (data.results || []) : data

    // Fallback: busca exata por barcode vazia -> tenta o número como texto.
    // Isso inclui DVDs recém-cadastrados, que podem não estar no índice de barcode.
    if (type === 'barcode' && Array.isArray(results) && results.length === 0 && fallbackApiUrl) {
      console.log('[Discogs] Barcode exact search empty, retrying as text query')
      try {
        const fallbackResponse = await fetch(fallbackApiUrl, {
          headers: {
            'User-Agent': userAgent,
            'Authorization': `Discogs token=${discogsToken}`,
            'Accept': 'application/json',
          },
        })
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json()
          const fallbackResults = fallbackData.results || []
          if (fallbackResults.length > 0) {
            results = fallbackResults
            data = fallbackData
          }
        } else {
          console.warn('[Discogs] Barcode text fallback failed:', fallbackResponse.status)
        }
      } catch (fallbackError) {
        console.warn('[Discogs] Barcode text fallback error:', fallbackError.message)
      }
    }

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

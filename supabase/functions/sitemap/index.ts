import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BASE_URL = Deno.env.get('BASE_URL') || 'https://raregroove.com'
const ITEMS_PER_PAGE = 100

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')

    const staticPages = [
      { url: '', changefreq: 'daily', priority: '1.0' },
      { url: '/catalog', changefreq: 'daily', priority: '0.9' },
      { url: '/about', changefreq: 'monthly', priority: '0.5' },
      { url: '/terms', changefreq: 'yearly', priority: '0.3' },
      { url: '/privacy', changefreq: 'yearly', priority: '0.3' },
      { url: '/faq', changefreq: 'monthly', priority: '0.6' },
      { url: '/shipping', changefreq: 'yearly', priority: '0.4' },
      { url: '/login', changefreq: 'yearly', priority: '0.4' },
      { url: '/register', changefreq: 'yearly', priority: '0.4' },
    ]

    const genres = [
      'rock', 'pop', 'jazz', 'classical', 'electronic',
      'hip-hop', 'metal', 'soul', 'funk', 'brazilian',
      'blues', 'reggae', 'punk', 'indie', 'world'
    ]

    const now = new Date().toISOString().split('T')[0]

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
`

    for (const page of staticPages) {
      xml += `  <url>
    <loc>${BASE_URL}${page.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`
    }

    for (const genre of genres) {
      xml += `  <url>
    <loc>${BASE_URL}/catalog?genre=${encodeURIComponent(genre)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
`
    }

    const { data: items, error } = await supabase
      .from('items')
      .select('id, updated_at, is_sold')
      .eq('is_sold', false)
      .order('updated_at', { ascending: false })
      .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1)

    if (!error && items) {
      for (const item of items) {
        const lastmod = item.updated_at ? item.updated_at.split('T')[0] : now
        xml += `  <url>
    <loc>${BASE_URL}/item/${item.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`
      }

      const { count } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('is_sold', false)

      const totalPages = Math.ceil((count || 0) / ITEMS_PER_PAGE)
      
      if (page < totalPages) {
        xml += `  <url>
    <loc>${BASE_URL}/sitemap.xml?page=${page + 1}</loc>
    <changefreq>hourly</changefreq>
    <priority>0.0</priority>
  </url>
`
      }
    }

    xml += `</urlset>`

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    })

  } catch (error) {
    console.error('Sitemap error:', error)
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`,
      { headers: { ...corsHeaders, 'Content-Type': 'application/xml' } }
    )
  }
})

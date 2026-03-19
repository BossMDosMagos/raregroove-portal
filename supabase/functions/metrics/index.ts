import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const url = new URL(req.url)
    const period = url.searchParams.get('period') || '30d'
    const userId = url.searchParams.get('userId')

    const now = new Date()
    let startDate = new Date()
    
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7)
        break
      case '30d':
        startDate.setDate(startDate.getDate() - 30)
        break
      case '90d':
        startDate.setDate(startDate.getDate() - 90)
        break
      case 'all':
        startDate = new Date(0)
        break
    }

    const startDateStr = startDate.toISOString()
    const endDateStr = now.toISOString()

    const [
      totalUsers,
      newUsers,
      activeUsers,
      totalItems,
      availableItems,
      soldItems,
      totalTransactions,
      transactionVolume,
      pendingSwaps,
      openDisputes,
      totalRevenue,
      platformFees,
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startDateStr),
      supabase.rpc('get_active_users_count', { days: 30 }),
      supabase.from('items').select('*', { count: 'exact', head: true }),
      supabase.from('items').select('*', { count: 'exact', head: true }).eq('is_sold', false),
      supabase.from('items').select('*', { count: 'exact', head: true }).eq('is_sold', true),
      supabase.from('transactions').select('*', { count: 'exact', head: true }).gte('created_at', startDateStr),
      supabase.from('transactions').select('total_amount').gte('created_at', startDateStr),
      supabase.from('swaps').select('*', { count: 'exact', head: true }).eq('status', 'aguardando_taxas'),
      supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'aberto'),
      supabase.from('transactions').select('platform_fee').gte('created_at', startDateStr),
      supabase.rpc('calculate_platform_fees', { start_date: startDateStr, end_date: endDateStr }),
    ])

    const { data: transactionsByDay } = await supabase
      .from('transactions')
      .select('created_at, total_amount')
      .gte('created_at', startDateStr)
      .order('created_at', { ascending: true })

    const { data: topSellers } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('role', 'seller')
      .order('total_sales', { ascending: false })
      .limit(10)

    const { data: topItems } = await supabase
      .from('items')
      .select('id, title, artist, price, image_url, seller_id')
      .eq('is_sold', true)
      .order('created_at', { ascending: false })
      .limit(10)

    const { data: genreDistribution } = await supabase
      .from('items')
      .select('genre')
      .eq('is_sold', false)
      .not('genre', 'is', null)

    const genreCounts = {}
    if (genreDistribution) {
      genreDistribution.forEach((item) => {
        const genre = item.genre || 'outros'
        genreCounts[genre] = (genreCounts[genre] || 0) + 1
      })
    }

    const dailyVolume = {}
    if (transactionsByDay) {
      transactionsByDay.forEach((tx) => {
        const day = tx.created_at.split('T')[0]
        dailyVolume[day] = (dailyVolume[day] || 0) + (tx.total_amount || 0)
      })
    }

    const volumeData = Object.entries(dailyVolume).map(([date, amount]) => ({
      date,
      amount: Math.round(amount * 100) / 100,
    }))

    const totalVolume = Array.isArray(transactionVolume?.data) 
      ? transactionVolume.data.reduce((sum, tx) => sum + (tx.total_amount || 0), 0)
      : 0

    const totalFees = Array.isArray(totalRevenue?.data)
      ? totalRevenue.data.reduce((sum, tx) => sum + (tx.platform_fee || 0), 0)
      : 0

    const response = {
      period,
      generatedAt: now.toISOString(),
      overview: {
        users: {
          total: totalUsers.count || 0,
          new: newUsers.count || 0,
          active: activeUsers?.data || 0,
        },
        items: {
          total: totalItems.count || 0,
          available: availableItems.count || 0,
          sold: soldItems.count || 0,
        },
        transactions: {
          total: totalTransactions.count || 0,
          volume: Math.round(totalVolume * 100) / 100,
        },
        platform: {
          fees: Math.round(totalFees * 100) / 100,
          pendingSwaps: pendingSwaps.count || 0,
          openDisputes: openDisputes.count || 0,
        },
      },
      charts: {
        dailyVolume: volumeData,
        genreDistribution: Object.entries(genreCounts).map(([genre, count]) => ({
          genre,
          count,
        })).sort((a, b) => b.count - a.count),
      },
      topSellers: topSellers || [],
      topItems: topItems || [],
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Metrics error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

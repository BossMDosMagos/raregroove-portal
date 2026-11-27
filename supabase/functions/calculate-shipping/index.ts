import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const cleanCep = (cep: unknown): string =>
  String(cep || '').replace(/\D/g, '').padEnd(8, '0').slice(0, 8)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { fromCep, toCep, weightKg, itemPrice } = await req.json()

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Supabase env not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const from = cleanCep(fromCep)
    const to = cleanCep(toCep)

    if (to.replace(/0/g, '') === '') {
      return new Response(JSON.stringify({ error: 'CEP de destino inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const headers = {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    }

    // Faixa do CEP de destino
    const rateRes = await fetch(
      `${supabaseUrl}/rest/v1/shipping_rates?cep_start=lte.${to}&cep_end=gte.${to}&active=eq.true&order=price.asc&limit=1`,
      { headers }
    )
    const rates = await rateRes.json()
    const rate = Array.isArray(rates) ? rates[0] : null

    // Percentual de seguro configurado no admin
    const settingsRes = await fetch(
      `${supabaseUrl}/rest/v1/platform_settings?select=insurance_percentage&order=id.asc&limit=1`,
      { headers }
    )
    const settings = await settingsRes.json()
    const insurancePct = Number(settings?.[0]?.insurance_percentage ?? 5)

    const basePrice = Number(rate?.price ?? 25)
    const maxWeight = Number(rate?.max_weight_kg ?? 2)
    const weight = Math.max(0.1, Number(weightKg) || 1)
    const declaredValue = Math.max(0, Number(itemPrice) || 0)

    // Mesma região (primeiro dígito do CEP) => frete reduzido
    const sameRegion = from.slice(0, 1) === to.slice(0, 1)
    const base = sameRegion ? Math.min(basePrice, 12) : basePrice

    const extraWeightKg = Math.max(0, weight - maxWeight)
    const weightFee = extraWeightKg * 5
    const insuranceFee = declaredValue * (insurancePct / 100)

    const cost = Number((base + weightFee + insuranceFee).toFixed(2))

    return new Response(JSON.stringify({
      data: {
        cost,
        estimatedDays: rate?.estimated_days ?? 7,
        sameRegion,
        breakdown: {
          base: Number(base.toFixed(2)),
          weightFee: Number(weightFee.toFixed(2)),
          insuranceFee: Number(insuranceFee.toFixed(2)),
          insurancePct,
        },
        fromCep: from,
        toCep: to,
      },
      error: null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ data: null, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

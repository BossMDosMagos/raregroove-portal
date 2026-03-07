// Supabase Edge Function para verificar status de pagamento (Polling)
// Deploy: supabase functions deploy verify-payment-status

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
    const { paymentId, externalReference, provider } = await req.json()

    if (provider === 'mercado_pago') {
      const accessToken = Deno.env.get('MP_ACCESS_TOKEN')
      if (!accessToken) throw new Error('MP_ACCESS_TOKEN não configurado')

      let url = ''
      if (paymentId) {
        url = `https://api.mercadopago.com/v1/payments/${paymentId}`
      } else if (externalReference) {
        url = `https://api.mercadopago.com/v1/payments/search?external_reference=${externalReference}`
      } else {
        throw new Error('Informe paymentId ou externalReference')
      }

      console.log(`[verify-payment-status] Consultando MP: ${url}`)

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('[verify-payment-status] Erro MP:', data)
        throw new Error(JSON.stringify(data))
      }

      // Se for busca por external_reference, pega o último pagamento
      let payment = data
      if (data.results && Array.isArray(data.results)) {
        if (data.results.length === 0) {
          return new Response(
            JSON.stringify({ status: 'pending', message: 'Nenhum pagamento encontrado ainda' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          )
        }
        // Ordenar por data de criação (mais recente primeiro) se necessário, mas MP já costuma mandar
        payment = data.results[0]
      }

      return new Response(
        JSON.stringify({
          status: payment.status, // approved, pending, rejected, etc.
          status_detail: payment.status_detail,
          id: payment.id,
          payment_method_id: payment.payment_method_id,
          transaction_amount: payment.transaction_amount
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    } 
    
    // Adicionar suporte a Stripe/PayPal se necessário futuramente
    
    return new Response(
      JSON.stringify({ error: 'Provider não suportado ou inválido' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )

  } catch (error) {
    console.error('[verify-payment-status] Erro:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

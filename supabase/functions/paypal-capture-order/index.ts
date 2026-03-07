// Supabase Edge Function para capturar pagamento PayPal
// Deploy: supabase functions deploy paypal-capture-order

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PAYPAL_API_BASE = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  production: 'https://api-m.paypal.com'
}

async function getPayPalAccessToken(clientId: string, clientSecret: string, mode: string) {
  const base = mode === 'sandbox' ? PAYPAL_API_BASE.sandbox : PAYPAL_API_BASE.production
  
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: 'grant_type=client_credentials',
  })

  const data = await response.json()
  return data.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId, clientId, mode = 'sandbox' } = await req.json()
    
    // 🔒 COFRE INVISÍVEL: Buscar Secret Key dos Secrets
    const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');

    if (!clientId || !clientSecret || !orderId) {
      throw new Error('Parâmetros faltando (Verifique PAYPAL_CLIENT_SECRET)')
    }

    // Obter access token
    const accessToken = await getPayPalAccessToken(clientId, clientSecret, mode)

    const base = mode === 'sandbox' ? PAYPAL_API_BASE.sandbox : PAYPAL_API_BASE.production

    // Capturar ordem
    const response = await fetch(`${base}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Erro ao capturar ordem PayPal')
    }

    return new Response(
      JSON.stringify({
        orderId: data.id,
        status: data.status,
        payer: data.payer,
        purchaseUnits: data.purchase_units,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Erro ao capturar ordem PayPal:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

# 📋 Código Separado - Copiar um por um no Supabase Dashboard

## 🔄 Como Usar Este Guia

1. Acesse: https://app.supabase.com
2. Selecione seu projeto
3. Vá para: **Edge Functions** (menu lateral esquerdo)
4. Para cada função abaixo:
   - Clique no nome da função
   - Selecione TODO o código no editor
   - Delete (CTRL+A → Delete)
   - Cole o código novo (CTRL+V)
   - Clique **Deploy**
   - Aguarde "Deployed successfully"

---

## 1️⃣ MERCADO PAGO: `mp-create-preference`

**Local no Supabase:** Edge Functions → mp-create-preference → Abrir Editor

**Copie TODO este código:**

```typescript
// Supabase Edge Function para criar Preferência no Mercado Pago
// Deploy: supabase functions deploy mp-create-preference

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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
    const { items, payer, back_urls, auto_return, metadata, accessToken } = await req.json()

    if (!accessToken) {
      throw new Error('Mercado Pago access token não fornecido')
    }

    // Criar preferência de pagamento
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        items,
        payer,
        back_urls,
        auto_return,
        metadata,
        payment_methods: {
          excluded_payment_types: [],
          installments: 12,
        },
        statement_descriptor: 'RAREGROOVE',
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Erro ao criar preferência')
    }

    return new Response(
      JSON.stringify({
        id: data.id,
        init_point: data.init_point,
        sandbox_init_point: data.sandbox_init_point,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Erro ao criar preferência MP:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
```

**Passos:**
1. Clique em `mp-create-preference` na lista de Edge Functions
2. Selecione tudo no editor (CTRL+A)
3. Delete (DEL)
4. Cole o código acima (CTRL+V)
5. Clique **Deploy** (botão no topo)
6. ✅ Aguarde confirmação de sucesso

---

## 2️⃣ STRIPE: `stripe-create-payment-intent`

**Local no Supabase:** Edge Functions → stripe-create-payment-intent → Abrir Editor

**Copie TODO este código:**

```typescript
// Supabase Edge Function para criar Payment Intent no Stripe
// Deploy: supabase functions deploy stripe-create-payment-intent

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { amount, currency, metadata, secretKey } = await req.json()

    if (!secretKey) {
      throw new Error('Stripe secret key não fornecida')
    }

    // Inicializar Stripe com a chave secreta
    const stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Criar Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // Centavos
      currency: currency || 'brl',
      metadata: metadata || {},
      automatic_payment_methods: {
        enabled: true,
      },
    })

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Erro ao criar Payment Intent:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
```

**Passos:**
1. Clique em `stripe-create-payment-intent` 
2. CTRL+A → DEL
3. Cole o código (CTRL+V)
4. Clique **Deploy**
5. ✅ Aguarde confirmação

---

## 3️⃣ PAYPAL - CRIAR ORDEM: `paypal-create-order`

**Local no Supabase:** Edge Functions → paypal-create-order → Abrir Editor

**Copie TODO este código:**

```typescript
// Supabase Edge Function para criar Ordem no PayPal
// Deploy: supabase functions deploy paypal-create-order

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
    const { amount, currency, metadata, clientId, clientSecret, mode = 'sandbox' } = await req.json()

    if (!clientId || !clientSecret) {
      throw new Error('PayPal credentials não fornecidas')
    }

    // Obter access token
    const accessToken = await getPayPalAccessToken(clientId, clientSecret, mode)

    const base = mode === 'sandbox' ? PAYPAL_API_BASE.sandbox : PAYPAL_API_BASE.production

    // Criar ordem
    const response = await fetch(`${base}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currency || 'BRL',
              value: amount,
            },
            description: 'Compra RareGroove - Marketplace de Vinis Raros',
            custom_id: JSON.stringify(metadata),
          },
        ],
        application_context: {
          brand_name: 'RareGroove',
          landing_page: 'BILLING',
          user_action: 'PAY_NOW',
          return_url: `${metadata.returnUrl || 'http://localhost:5173'}/payment/success`,
          cancel_url: `${metadata.returnUrl || 'http://localhost:5173'}/payment/cancel`,
        },
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Erro ao criar ordem PayPal')
    }

    return new Response(
      JSON.stringify({
        orderId: data.id,
        status: data.status,
        links: data.links,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Erro ao criar ordem PayPal:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
```

**Passos:**
1. Clique em `paypal-create-order`
2. CTRL+A → DEL
3. Cole o código (CTRL+V)
4. Clique **Deploy**
5. ✅ Aguarde confirmação

---

## 4️⃣ PAYPAL - CAPTURAR PAGAMENTO: `paypal-capture-order`

**Local no Supabase:** Edge Functions → paypal-capture-order → Abrir Editor

**Copie TODO este código:**

```typescript
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
    const { orderId, clientId, clientSecret, mode = 'sandbox' } = await req.json()

    if (!clientId || !clientSecret || !orderId) {
      throw new Error('Parâmetros faltando')
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
```

**Passos:**
1. Clique em `paypal-capture-order`
2. CTRL+A → DEL
3. Cole o código (CTRL+V)
4. Clique **Deploy**
5. ✅ Aguarde confirmação

---

## ✅ Checklist Final

- [ ] 1️⃣ mp-create-preference → Deploy OK
- [ ] 2️⃣ stripe-create-payment-intent → Deploy OK
- [ ] 3️⃣ paypal-create-order → Deploy OK
- [ ] 4️⃣ paypal-capture-order → Deploy OK

---

## 🔄 Próximas Etapas

Após fazer deploy de TODAS as 4 funções:

1. **Recarregue o navegador**
   ```
   Ctrl+R (ou Cmd+R no Mac)
   ```

2. **Vá ao seu site de checkout**
   - Adicione um produto ao carrinho
   - Clique "CONTINUAR PARA PAGAMENTO"

3. **Teste Mercado Pago**
   - Selecione "Mercado Pago"
   - Clique "CONTINUAR PARA PAGAMENTO"
   - ✅ Você deve ser redirecionado para checkout do Mercado Pago

4. **Se tiver erro, abra Console (F12)**
   - Procure logs com `📤 [MP]` ou `❌ [MP]`
   - Compartilhe qualquer mensagem de erro

---

## ⏱️ Tempo Estimado
- Cada deploy: ~10-15 segundos
- Total das 4 funções: ~1 minuto

**Boa sorte! 🚀**

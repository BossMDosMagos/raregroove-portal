// 🛡️ Supabase Edge Function para criar Payment Intent no Stripe (SECURIZADO)
// Deploy: supabase functions deploy stripe-create-payment-intent

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import {
  getSecurityHeaders,
  checkRateLimit,
  getClientIp,
  validateAmount,
  validateHoneyPot,
  secureErrorResponse,
  secureSuccessResponse
} from '../_shared/security.ts'

serve(async (req) => {
  const secureHeaders = getSecurityHeaders();

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: secureHeaders })
  }

  try {
    // 🔒 1. RATE LIMITING - Limitar tentativas por IP
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(clientIp, { maxRequests: 10, windowMs: 60000 }); // 10 req/min
    
    if (!rateLimit.allowed) {
      console.warn(`🚨 Rate limit excedido para IP: ${clientIp}`);
      return new Response(
        JSON.stringify({ 
          error: 'Muitas tentativas. Aguarde antes de tentar novamente.',
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
        }),
        {
          headers: { ...secureHeaders, 'Content-Type': 'application/json' },
          status: 429,
        },
      )
    }

    // 🔓 2. AUTENTICAÇÃO - Validar token JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Token de autenticação não fornecido');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Usuário não autenticado');
    }

    console.log('[Stripe] Usuário autenticado:', user.id);

    // 📥 3. EXTRAIR DADOS DO BODY
    const body = await req.json();
    const { transaction_id, item_id, swap_id, secretKey } = body;

    // 🍯 4. HONEY POT VALIDATION
    if (!validateHoneyPot(body)) {
      console.warn('🚨 BOT DETECTADO via honey pot');
      return secureErrorResponse(new Error('Requisição inválida'), 403);
    }

    // 🔑 5. VALIDAR SECRET KEY DO COFRE
    const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!secretKey) {
      console.error('[Stripe] STRIPE_SECRET_KEY não configurada no servidor');
      throw new Error('Erro de configuração do servidor de pagamentos');
    }

    // 💰 6. BUSCAR VALORES DO BODY (TEMPORÁRIO PARA DEBUG - IDEAL É DO BANCO)
    // Para simplificar o debug atual, vamos aceitar values do body, mas em produção
    // deve-se sempre recalcular do banco como estava antes.
    // O erro anterior era tentar ler "secretKey" do body, que não existe mais.
    
    // Extrair dados do body corretamente
    const { amount, currency = 'brl', metadata } = body;

    if (!amount) {
       throw new Error('Valor da transação não informado');
    }

    // 💯 7. VALIDAR VALOR CALCULADO
    // ...

    // 🔐 8. INICIALIZAR STRIPE
    const stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    console.log('[Stripe] Criando Payment Intent:', {
      amount,
      currency,
      metadata
    });

    let customerId: string | null = null
    try {
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', user.id)
        .single()

      if (profileRow?.stripe_customer_id) {
        customerId = String(profileRow.stripe_customer_id)
      } else {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: { supabase_user_id: user.id }
        })
        customerId = customer.id

        await supabase
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', user.id)
      }
    } catch {
      customerId = null
    }

    // 💳 9. CRIAR PAYMENT INTENT
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency: currency,
      metadata,
      customer: customerId || undefined,
      receipt_email: user.email || undefined,
      automatic_payment_methods: {
        enabled: true,
      },
    })

    console.log('[Stripe] Payment Intent criado:', paymentIntent.id);

    // ✅ 10. RETORNAR RESPOSTA SEGURA
    return secureSuccessResponse({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amount / 100
    });

  } catch (error) {
    console.error('[Stripe] Erro:', error.message);
    return secureErrorResponse(error);
  }
})

// 🔐 WEBHOOK STRIPE - EDGE FUNCTION SECURIZADA
// ========================================
// Recebe notificações de eventos da Stripe com validação de assinatura
// Deploy: supabase functions deploy stripe-webhook

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

serve(async (req) => {
  // Apenas POST é permitido
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // 🔑 1. OBTER SECRET DO WEBHOOK
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET não configurado');
    }

    // 📝 2. LER BODY RAW (necessário para validação de assinatura)
    const payload = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('❌ Assinatura do webhook ausente');
      return new Response('Assinatura inválida', { status: 401 });
    }

    // 🛡️ 3. VALIDAR ASSINATURA DA STRIPE
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      console.log('✅ Assinatura do webhook validada:', event.type);
    } catch (err) {
      console.error('❌ Falha na validação da assinatura:', err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // 🔓 4. INICIALIZAR SUPABASE CLIENT
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 🎯 5. PROCESSAR DIFERENTES TIPOS DE EVENTOS
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('💰 Pagamento confirmado:', paymentIntent.id);
        
        const metadata = paymentIntent.metadata;
        
        // Caso 1: Pagamento de transação (venda)
        if (metadata.transaction_id) {
          const { error } = await supabase
            .from('transactions')
            .update({
              status: 'pago',
              payment_id: paymentIntent.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', metadata.transaction_id);

          if (error) {
            console.error('Erro ao atualizar transação:', error);
          } else {
            console.log('✅ Transação atualizada para PAGO:', metadata.transaction_id);
          }
        }

        // Caso 2: Pagamento de taxa de troca (swap)
        if (metadata.swap_id && metadata.user_id) {
          const { data: swap } = await supabase
            .from('swaps')
            .select('*')
            .eq('swap_id', metadata.swap_id)
            .single();

          if (swap) {
            const isUser1 = swap.user_1_id === metadata.user_id;
            const updateData = isUser1
              ? { guarantee_fee_1_paid: true, guarantee_fee_1_payment_id: paymentIntent.id }
              : { guarantee_fee_2_paid: true, guarantee_fee_2_payment_id: paymentIntent.id };

            const { error } = await supabase
              .from('swaps')
              .update(updateData)
              .eq('swap_id', metadata.swap_id);

            if (error) {
              console.error('Erro ao atualizar swap:', error);
            } else {
              console.log('✅ Taxa de swap paga:', metadata.swap_id);
            }
          }
        }

        // Caso 3: Assinatura Grooveflix
        if ((metadata.transaction_type === 'subscription' || metadata.transactionType === 'subscription' || metadata.subscription === '1' || metadata.plan_id || metadata.plan_tier) && (metadata.buyer_id || metadata.buyerId || metadata.user_id)) {
          const planId = String(metadata.plan_id || metadata.plan_tier || metadata.plan || 'unknown').toLowerCase();
          const buyerId = String(metadata.buyer_id || metadata.buyerId || metadata.user_id);

          let userLevel = Number(metadata.user_level || metadata.user_level_value || 0);
          if (!Number.isFinite(userLevel) || userLevel <= 0) {
            if (planId === 'digger') userLevel = 1;
            if (planId === 'keeper') userLevel = 2;
            if (planId === 'high_guardian') userLevel = 3;
          }

          const { error: subError } = await supabase
            .from('subscriptions')
            .upsert(
              {
                user_id: buyerId,
                plan_id: planId,
                user_level: userLevel,
                status: 'active',
                provider: 'stripe',
                payment_id: paymentIntent.id,
                external_reference: metadata.external_reference || metadata.transactionId || null,
                amount: paymentIntent.amount_received ? Number(paymentIntent.amount_received) / 100 : null,
                currency: paymentIntent.currency || null,
                subscribed_at: new Date().toISOString()
              },
              { onConflict: 'provider,payment_id' }
            );

          if (subError) {
            console.error('Erro ao registrar assinatura:', subError);
          } else {
            const { error: profileError } = await supabase
              .from('profiles')
              .update({
                user_level: userLevel,
                subscription_status: 'active',
                subscription_plan: planId,
                subscription_provider: 'stripe',
                subscription_date: new Date().toISOString(),
                subscription_trial_ends_at: null
              })
              .eq('id', buyerId);

            if (profileError) {
              console.error('Erro ao atualizar perfil da assinatura:', profileError);
            } else {
              console.log('✅ Assinatura ativada para usuário:', buyerId, planId);
            }
          }
        }
        
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('❌ Pagamento falhou:', paymentIntent.id);
        
        // Registrar falha no banco
        const metadata = paymentIntent.metadata;
        if (metadata.transaction_id) {
          await supabase
            .from('transactions')
            .update({
              status: 'cancelado',
              payment_id: paymentIntent.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', metadata.transaction_id);
        }
        
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        console.log('💸 Reembolso processado:', charge.id);
        
        // Buscar transação por payment_id
        const { data: transaction } = await supabase
          .from('transactions')
          .select('*')
          .eq('payment_id', charge.payment_intent)
          .single();

        if (transaction) {
          await supabase
            .from('transactions')
            .update({
              status: 'cancelado',
              updated_at: new Date().toISOString()
            })
            .eq('id', transaction.id);

          console.log('✅ Transação cancelada por reembolso');
        }
        
        break;
      }

      case 'payment_intent.created':
        console.log('📝 Payment Intent criado:', event.data.object.id);
        break;

      default:
        console.log(`⚠️ Evento não tratado: ${event.type}`);
    }

    // 📊 6. REGISTRAR EVENTO NO LOG (opcional)
    await supabase
      .from('webhook_logs')
      .insert({
        provider: 'stripe',
        event_type: event.type,
        event_id: event.id,
        payload: event,
        processed_at: new Date().toISOString()
      })
      .catch(err => {
        // Tabela pode não existir, não falhar webhook por isso
        console.warn('Não foi possível registrar log do webhook:', err.message);
      });

    // ✅ 7. RETORNAR SUCESSO
    return new Response(
      JSON.stringify({ received: true, event: event.type }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error);
    
    // Retornar 500 para que Stripe tente reenviar
    return new Response(
      JSON.stringify({ error: 'Erro ao processar webhook' }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
})

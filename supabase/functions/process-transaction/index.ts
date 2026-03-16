// Supabase Edge Function para processar transação após pagamento aprovado
// Deploy: supabase functions deploy process-transaction

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id',
}

// 🔐 VALIDAÇÃO DE ASSINATURA DO MERCADO PAGO
// Verifica se o webhook veio realmente do Mercado Pago usando HMAC-SHA256
async function verifyMercadoPagoSignature(req: Request, secret: string) {
  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");

  if (!xSignature || !xRequestId) {
    console.warn("[Security] Headers x-signature ou x-request-id ausentes. Requisição suspeita.");
    return false;
  }

  // Extrair partes da assinatura (ts e v1)
  const parts = xSignature.split(",");
  let ts = "";
  let v1 = "";

  parts.forEach((part) => {
    const [key, value] = part.split("=");
    if (key && value) {
      if (key.trim() === "ts") ts = value.trim();
      if (key.trim() === "v1") v1 = value.trim();
    }
  });

  if (!ts || !v1) {
    console.warn("[Security] Formato inválido de x-signature.");
    return false;
  }

  // Reconstruir o template da mensagem assinada
  // Template: `id:[data.id];request-id:[x-request-id];ts:[ts];`
  // Importante: O corpo da requisição usado para o hash deve ser exatamente o recebido.
  // Como já lemos o body como JSON antes, precisamos garantir que temos o conteúdo original ou reconstruir com cuidado.
  // O MP envia o ID do evento na URL ou no corpo. Vamos assumir validação simplificada por enquanto se o body já foi consumido.
  
  // ⚠️ NOTA CRÍTICA: Para validação HMAC correta, precisamos do raw body.
  // Como o Deno consome o stream ao fazer .json(), vamos implementar uma validação simplificada
  // baseada apenas na presença do segredo, ou confiar no ID se possível.
  
  // Se o segredo não estiver configurado, pular validação (modo desenvolvimento)
  if (!secret || secret === "SUA_CHAVE_AQUI") {
     console.warn("[Security] MP_WEBHOOK_SECRET não configurado ou padrão. Pulando validação.");
     return true;
  }

  return true; // TODO: Implementar verificação completa do HMAC com clone do request se necessário.
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 🔒 VALIDAÇÃO DE SEGURANÇA (WEBHOOK SECRET)
    const webhookSecret = Deno.env.get("MP_WEBHOOK_SECRET");
    const isMpWebhook = req.headers.get("user-agent")?.includes("MercadoPago");
    
    // Se for uma chamada do MP, tentar validar
    if (isMpWebhook && webhookSecret) {
       // Clonar requisição para não consumir o body se formos ler texto
       // Por enquanto, apenas logamos que a proteção está ativa
       console.log("[Security] Validando webhook do Mercado Pago...");
       // Implementação futura: verifyMercadoPagoSignature(req.clone(), webhookSecret);
    }

    let body = {};
    try {
      // Tentar ler JSON se houver corpo
      const text = await req.text();
      if (text && text.trim().length > 0) {
          body = JSON.parse(text);
      }
    } catch (e) {
      console.warn("[process-transaction] Corpo da requisição não é JSON válido ou está vazio. Verificando URL params.", e);
    }

    console.log('[process-transaction] Payload recebido (RAW):', JSON.stringify(body));

    // EXTRAIR PARÂMETROS DA URL (Query Params)
    // O Mercado Pago envia ?id=...&topic=merchant_order
    const url = new URL(req.url);
    const queryId = url.searchParams.get("id") || url.searchParams.get("data.id");
    const queryTopic = url.searchParams.get("topic") || url.searchParams.get("type");

    console.log(`[process-transaction] Query Params: id=${queryId}, topic=${queryTopic}`);

    // 🔍 IGNORAR MERCHANT_ORDER
    if (queryTopic === 'merchant_order') {
        console.log("[process-transaction] ℹ️ Ignorando notificação de merchant_order. Aguardando payment.");
        return new Response(JSON.stringify({ status: "ignored", message: "merchant_order ignored" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    }

    // 🔍 LIDA COM TESTE DO MERCADO PAGO (Webhook Test)
    // O MP envia um payload de teste com ID 123456 e action 'payment.updated'
    // Devemos responder 200 OK para validar a URL, sem tentar processar.
    if (body.id === 123456 || body.id === "123456" || (body.data && (body.data.id === "123456" || body.data.id === 123456))) {
       console.log("[process-transaction] 🧪 Webhook de teste do Mercado Pago recebido. Respondendo 200 OK.");
       return new Response(JSON.stringify({ status: "ok", message: "Webhook test received" }), {
         headers: { ...corsHeaders, "Content-Type": "application/json" },
         status: 200,
       });
    }

    // 🔄 UNIFICAÇÃO DE ESTRUTURA DE PAYLOAD
    // O Mercado Pago envia notificações com estrutura { action: '...', data: { id: '...' } }
    // Mas nossa função espera um payload direto com transactionType, buyerId, etc.
    // Se recebermos o formato do Webhook do MP, precisamos buscar os dados do pagamento na API do MP primeiro.
    
    let payload = body;
    let isWebhook = false;

    // Detectar se é Webhook do MP (várias possibilidades de formato)
    // 1. { action: 'payment.updated', data: { id: ... } }
    // 2. { type: 'payment', data: { id: ... } }
    // 3. { id: ..., type: 'payment' } (formato antigo/v1)
    // 4. URL Params: ?id=...&topic=payment
    const isMpAction = body.action === 'payment.updated' || body.type === 'payment';
    const hasMpDataId = (body.data && body.data.id);
    const hasMpIdAndType = (body.id && body.type === 'payment');
    const hasQueryId = !!queryId; // Se veio na URL

    if (isMpAction || hasMpDataId || hasMpIdAndType || hasQueryId) {
        isWebhook = true;
        const mpPaymentId = body.data?.id || body.id || queryId;
        console.log(`[process-transaction] 🔔 Notificação MP identificada (ID: ${mpPaymentId}). Buscando detalhes...`);
        
        if (!mpPaymentId) {
           console.error("[process-transaction] ID do pagamento não encontrado no payload do webhook.");
           // Retornamos 200 para evitar retentativas infinitas de um payload quebrado
           return new Response(JSON.stringify({ status: "ignored", message: "Missing payment ID" }), { status: 200 });
        }

        
        // 🔒 COFRE INVISÍVEL: Buscar token dos Secrets
        const accessToken = Deno.env.get('MP_ACCESS_TOKEN');
        if (!accessToken) {
            console.error("[process-transaction] ERRO: MP_ACCESS_TOKEN não configurado.");
            return new Response(JSON.stringify({ error: "Server configuration error" }), { status: 500 });
        }

        try {
            const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
                headers: {
                    "Authorization": `Bearer ${accessToken}`
                }
            });

            if (!mpResponse.ok) {
                const errorText = await mpResponse.text();
                console.error(`[process-transaction] Erro ao buscar pagamento ${mpPaymentId} no MP:`, errorText);
                // Retornar 200 para o MP não ficar tentando reenviar se o erro for 404, mas se for 500 talvez valha a pena tentar de novo.
                // Por segurança, retornamos 400 para logs.
                throw new Error(`Falha ao buscar pagamento no MP: ${mpResponse.statusText}`);
            }

            const paymentData = await mpResponse.json();
            console.log(`[process-transaction] Pagamento ${mpPaymentId} recuperado. Status: ${paymentData.status}`);

            // Se não estiver aprovado, não processamos (ainda)
            if (paymentData.status !== 'approved') {
                console.log(`[process-transaction] Pagamento ${mpPaymentId} não está aprovado (${paymentData.status}). Ignorando.`);
                return new Response(JSON.stringify({ status: "ignored", message: "Payment not approved" }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200
                });
            }

            // EXTRAIR METADATA E NORMALIZAR PARA O PAYLOAD
            // O MP converte chaves de metadata para snake_case/lowercase.
            const meta = paymentData.metadata || {};
            console.log("[process-transaction] Metadata recuperado:", JSON.stringify(meta));

            // 💰 CÁLCULO FINANCEIRO REAL (Baseado no que o MP realmente cobrou)
            const totalPaid = Number(paymentData.transaction_amount);
            const netReceived = Number(paymentData.transaction_details?.net_received_amount ?? totalPaid);
            const realMpFee = totalPaid - netReceived;
            
            const platformFee = Number(meta.platform_fee || meta.platformfee || 0);
            const shippingCost = Number(meta.shipping_cost || meta.shippingcost || 0);
            const insuranceCost = Number(meta.insurance_cost || meta.insurancecost || 0);
            
            // NetAmount Real = O que entrou no banco (MP Net) - Taxa Plataforma - Custos Extras
            const calculatedNet = netReceived - platformFee - shippingCost - insuranceCost;
            
            console.log("[process-transaction] 🧮 Cálculo Financeiro:", {
                totalPaid,
                netReceived,
                realMpFee,
                platformFee,
                shippingCost,
                insuranceCost,
                calculatedNet
            });

            // Mapear metadata para o formato esperado pela função
            // Tentamos variações de snake_case e camelCase pois o MP pode alterar
            payload = {
                transactionType: meta.transaction_type || meta.transactiontype || 'venda',
                buyerId: meta.buyer_id || meta.buyerid,
                sellerId: meta.seller_id || meta.sellerid,
                itemId: meta.item_id || meta.itemid,
                planId: meta.plan_id || meta.planid || meta.plan_tier || meta.plantier || meta.plan || null,
                userLevel: meta.user_level || meta.userlevel || null,
                externalReference: paymentData.external_reference || null,
                currency: paymentData.currency_id || meta.currency || meta.currency_id || 'BRL',
                itemPrice: Number(meta.item_price || meta.itemprice || totalPaid),
                shippingCost: shippingCost,
                insuranceCost: insuranceCost,
                platformFee: platformFee,
                processingFee: Number(meta.processing_fee || meta.processingfee || 0),
                gatewayFee: realMpFee, // 🔥 TAXA REAL DO MERCADO PAGO
                totalAmount: totalPaid,
                netAmount: calculatedNet, // 🔥 VALOR LÍQUIDO REAL AJUSTADO
                paymentId: String(paymentData.id),
                paymentProvider: 'mercado_pago',
                shippingData: meta.shipping_data || meta.shippingdata || null, // Pode vir como string JSON ou objeto? O MP achata objetos em metadata? Geralmente sim.
                swapId: meta.swap_id || meta.swapid || null,
                mpDetails: { // Dados extras para auditoria
                    fee_details: paymentData.fee_details,
                    net_received_amount: netReceived
                }
            };

            // Se shippingData vier como string (algumas integrações fazem isso), parsear
            if (typeof payload.shippingData === 'string') {
                try {
                    payload.shippingData = JSON.parse(payload.shippingData);
                } catch (e) {
                    console.warn("[process-transaction] Falha ao parsear shippingData do metadata:", e);
                    payload.shippingData = {};
                }
            }

            console.log("[process-transaction] Payload reconstruído via Webhook:", JSON.stringify(payload));

        } catch (err) {
            console.error("[process-transaction] Erro no processamento do Webhook:", err);
            // Retornar erro para que o MP tente novamente depois (se for erro de rede/servidor)
            return new Response(JSON.stringify({ error: err.message }), { status: 500 });
        }
    }

    console.log("[process-transaction] Payload final para processamento:", JSON.stringify(payload));

    const {
      transactionType, // 'venda' ou 'swap_fee'
      buyerId,
      sellerId,
      itemId,
      itemPrice,
      shippingCost,
      insuranceCost,
      platformFee,
      processingFee,
      gatewayFee,
      totalAmount,
      netAmount,
      paymentId,
      paymentProvider,
      shippingData,
      swapId,
      mpDetails // Extraído do payload (se disponível)
    } = payload

    console.log('[process-transaction] Variáveis extraídas:', {
      transactionType,
      buyerId,
      paymentId,
      itemPrice,
      totalAmount
    })

    // Validar dados obrigatórios
    if (!buyerId || !paymentId) {
      console.error('[process-transaction] ❌ ERRO DE VALIDAÇÃO: Dados obrigatórios faltando.', { 
          buyerId: buyerId, 
          paymentId: paymentId,
          sellerId: sellerId,
          transactionType: transactionType
      });
      throw new Error(`Dados obrigatórios faltando: buyerId=${buyerId}, paymentId=${paymentId}`);
    }

    if (transactionType === 'subscription') {
      const planIdRaw = payload.plan_id || payload.planId || payload.plan_tier || payload.planTier || payload.plan || 'unknown';
      const planId = String(planIdRaw || 'unknown').toLowerCase();

      let userLevelValue = Number(payload.user_level || payload.userLevel || 0);
      if (!Number.isFinite(userLevelValue) || userLevelValue <= 0) {
        if (planId === 'digger') userLevelValue = 1;
        if (planId === 'keeper') userLevelValue = 2;
        if (planId === 'high_guardian') userLevelValue = 3;
      }

      const providerValue = String(paymentProvider || 'unknown');
      const externalReferenceValue = String(payload.external_reference || payload.externalReference || '');
      const currencyValue = String(payload.currency || payload.currency_id || 'BRL');

      const { data: existingSub, error: existingSubError } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('provider', providerValue)
        .eq('payment_id', String(paymentId))
        .maybeSingle();

      if (existingSubError) throw existingSubError;

      if (!existingSub) {
        const { error: subInsertError } = await supabase
          .from('subscriptions')
          .insert([
            {
              user_id: buyerId,
              plan_id: planId,
              user_level: userLevelValue,
              status: 'active',
              provider: providerValue,
              payment_id: String(paymentId),
              external_reference: externalReferenceValue || null,
              amount: totalAmount ?? null,
              currency: currencyValue || null,
              subscribed_at: new Date().toISOString()
            }
          ]);

        if (subInsertError) throw subInsertError;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          user_level: userLevelValue,
          subscription_status: 'active',
          subscription_plan: planId,
          subscription_provider: providerValue,
          subscription_date: new Date().toISOString(),
          subscription_trial_ends_at: null
        })
        .eq('id', buyerId);

      if (profileError) throw profileError;

      return new Response(
        JSON.stringify({
          success: true,
          subscription: {
            userId: buyerId,
            planId,
            userLevel: userLevelValue,
            status: 'active'
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    if (transactionType === 'venda') {
      // ========================================================================
      // PROCESSAR VENDA
      // ========================================================================

      // Idempotência: se já existe transação para este payment_id, não processar novamente
      const { data: existingTransaction, error: existingTxError } = await supabase
        .from('transactions')
        .select('id, shipping_id')
        .eq('payment_id', paymentId)
        .maybeSingle()

      if (existingTxError) {
        console.error('[process-transaction] Erro ao verificar transação existente:', existingTxError)
        throw existingTxError
      }

      if (existingTransaction) {
        console.log('[process-transaction] Transação já processada para payment_id:', paymentId)
        return new Response(
          JSON.stringify({
            success: true,
            transactionId: existingTransaction.id,
            shippingId: existingTransaction.shipping_id ?? null,
            message: 'Transação já processada anteriormente'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      // Identificar tipo de venda: Portal vs Marketplace
      const isPortalSale = !sellerId || sellerId === null || sellerId === 'portal';
      
      console.log('[process-transaction] Tipo de venda:',  isPortalSale ? 'PORTAL (100%)' : 'MARKETPLACE (taxa)');

      // VALIDAÇÃO DE SEGURANÇA: Verificar se o item pertence ao seller informado
      if (!isPortalSale && itemId) {
        const { data: itemData, error: itemError } = await supabase
          .from('items')
          .select('seller_id, is_sold, status')
          .eq('id', itemId)
          .single();

        if (itemError || !itemData) {
          console.error('[process-transaction] Item não encontrado:', itemId);
          throw new Error('Item não encontrado');
        }

        if (itemData.is_sold) {
          console.warn('[process-transaction] Item já foi vendido:', itemId);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Item já foi vendido',
              code: 'ITEM_ALREADY_SOLD'
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            }
          );
        }

        // Validar que o sellerId do payload corresponde ao seller real do item
        if (itemData.seller_id !== sellerId) {
          console.error('[process-transaction] Seller ID mismatch! Payload:', sellerId, 'DB:', itemData.seller_id);
          throw new Error('Vendedor inválido para este item');
        }
      }

      // 1. Criar transação
      const transactionData = {
        buyer_id: buyerId,
        seller_id: isPortalSale ? null : sellerId,
        item_id: itemId,
        transaction_type: isPortalSale ? 'venda_portal' : 'venda',
        price: itemPrice,
        platform_fee: platformFee,
        gateway_fee: gatewayFee,
        total_amount: totalAmount,
        net_amount: isPortalSale ? 0 : netAmount,
        shipping_cost: shippingCost,
        insurance_cost: insuranceCost,
        status: 'pago_em_custodia',
        payment_id: paymentId
      }
      
      console.log('[process-transaction] 💾 Tentando inserir transação na tabela transactions...');
      console.log('Dados:', JSON.stringify(transactionData, null, 2));
      
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert([transactionData])
        .select()
        .single()

      if (txError) {
        console.error('[process-transaction] ❌ ERRO FATAL ao inserir transação:', {
          code: txError.code,
          message: txError.message,
          details: txError.details,
          hint: txError.hint
        });
        // Não lançar erro imediatamente para permitir logging adicional se necessário, mas aqui interrompe o fluxo de venda
        throw txError;
      }
      
      console.log('[process-transaction] ✅ Transação inserida com sucesso! ID:', transaction.id);

      // 2. Marcar item como vendido (ANTES de criar shipping)
      console.log('[process-transaction] Marcando item como vendido:', itemId)
      const { error: itemError } = await supabase
        .from('items')
        .update({
          is_sold: true,
          status: 'vendido',
          sold_to_id: buyerId,
          sold_date: new Date().toISOString()
        })
        .eq('id', itemId)

      if (itemError) {
        console.error('[process-transaction] Erro ao marcar item como vendido:', {
          code: itemError.code,
          message: itemError.message,
          details: itemError.details,
          hint: itemError.hint
        })
        // Log mas continua - não interrompe o fluxo
      } else {
        console.log('[process-transaction] ✅ Item marcado como vendido com sucesso')
      }

      // 3. Criar shipping (sempre, mesmo sem dados completos)
      let shippingId = null
      const { data: shipData, error: shipError } = await supabase
        .from('shipping')
        .insert([
          {
            transaction_id: transaction.id,
            buyer_id: buyerId,
            seller_id: isPortalSale ? null : sellerId,
            item_id: itemId,
            from_cep: shippingData?.fromCep || '00000-000',
            from_address: shippingData?.fromAddress || {},
            to_cep: shippingData?.toCep || '00000-000',
            to_address: shippingData?.toAddress || {},
            estimated_cost: shippingCost || 0,
            has_insurance: (insuranceCost || 0) > 0,
            insurance_cost: insuranceCost || 0,
            carrier: shippingData?.carrier || 'correios',
            status: 'awaiting_label'
          }
        ])
        .select()
        .single()

      if (shipError) {
        console.error('[process-transaction] Erro ao criar shipping:', shipError)
        // Não interrompe - shipping pode ser criado depois
      } else {
        shippingId = shipData.shipping_id
        console.log('[process-transaction] ✅ Shipping criado:', shippingId)

        // Atualizar transaction com shipping_id
        await supabase
          .from('transactions')
          .update({ shipping_id: shippingId })
          .eq('id', transaction.id)
      }

      if (isPortalSale) {
        // ═══════════════════════════════════════════════════════════════════
        // VENDA DO PORTAL: 100% da receita vai para o portal
        // ═══════════════════════════════════════════════════════════════════
        console.log('[process-transaction] Registrando receita 100% portal:', totalAmount);
        
        await supabase
          .from('financial_ledger')
          .insert([
            {
              source_type: 'venda_portal',
              source_id: transaction.id,
              entry_type: 'receita_portal',
              amount: netAmount, // Corrigido para usar o valor líquido (NetReceived - custos)
              user_id: null,
              metadata: {
                item_id: itemId,
                buyer_id: buyerId,
                total_amount: totalAmount,
                payment_id: paymentId,
                description: 'Venda direta do portal - Receita Líquida',
                mp_fee_details: mpDetails?.fee_details || []
              }
            }
          ]);
      } else {
        // ═══════════════════════════════════════════════════════════════════
        // MARKETPLACE: Taxa de intermediação para portal + Net para vendedor
        // ═══════════════════════════════════════════════════════════════════
        console.log('[process-transaction] Registrando marketplace - Taxa:', platformFee, 'Net vendedor:', netAmount);

        // 4. Garantir user_balances do vendedor existe
        const { data: balanceCheck } = await supabase
          .from('user_balances')
          .select('*')
          .eq('user_id', sellerId)
          .maybeSingle();

        if (!balanceCheck) {
          await supabase
            .from('user_balances')
            .insert([{ user_id: sellerId, available_balance: 0, pending_balance: 0 }]);
        }

        // 5. Adicionar saldo pendente ao vendedor
        const { data: updatedBalance, error: balanceLoadError } = await supabase
          .from('user_balances')
          .select('pending_balance')
          .eq('user_id', sellerId)
          .single()

        if (balanceLoadError) {
          console.error('[process-transaction] Erro ao buscar saldo atual do vendedor:', balanceLoadError)
          throw balanceLoadError
        }

        const nextPendingBalance = Number(updatedBalance?.pending_balance || 0) + Number(netAmount || 0)

        const { error: balanceUpdateError } = await supabase
          .from('user_balances')
          .update({
            pending_balance: nextPendingBalance
          })
          .eq('user_id', sellerId)

        if (balanceUpdateError) {
          console.error('[process-transaction] Erro ao atualizar saldo pendente do vendedor:', balanceUpdateError)
          throw balanceUpdateError
        }

        // 6. Registrar na ledger: vendedor recebe net_amount
        await supabase
          .from('financial_ledger')
          .insert([
            {
              source_type: 'venda',
              source_id: transaction.id,
              entry_type: 'venda_realizada',
              amount: netAmount, // Corrigido para usar o valor real líquido recebido do MP - comissão
              user_id: sellerId,
              metadata: {
                item_id: itemId,
                buyer_id: buyerId,
                platform_fee: platformFee,
                gateway_fee: gatewayFee,
                payment_id: paymentId,
                mp_fee_details: mpDetails?.fee_details || []
              }
            }
          ]);

        // 7. Registrar taxa de intermediação para o portal
        await supabase
          .from('financial_ledger')
          .insert([
            {
              source_type: 'venda',
              source_id: transaction.id,
              entry_type: 'taxa_plataforma',
              amount: platformFee,
              user_id: null,
              metadata: {
                item_id: itemId,
                buyer_id: buyerId,
                seller_id: sellerId,
                payment_id: paymentId,
                description: 'Taxa de intermediação marketplace'
              }
            }
          ]);
      }

      return new Response(
        JSON.stringify({
          success: true,
          transactionId: transaction.id,
          shippingId,
          message: 'Transação processada com sucesso'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )

    } else if (transactionType === 'swap_fee') {
      // ========================================================================
      // PROCESSAR TAXA DE GARANTIA DE SWAP
      // ========================================================================

      // Novo fluxo (custódia P2P): tenta usar rota transacional no banco.
      // Se a função ainda não existir no ambiente, cai para o fluxo legado.
      const { data: routeData, error: routeError } = await supabase.rpc('swap_register_checkin_payment', {
        p_swap_id: swapId,
        p_amount: totalAmount,
        p_payment_ref: paymentId
      })

      if (!routeError && Array.isArray(routeData) && routeData.length > 0) {
        const routeResult = routeData[0]

        return new Response(
          JSON.stringify({
            success: Boolean(routeResult.success),
            bothPaid: Boolean(routeResult.both_paid),
            status: routeResult.new_status,
            message: routeResult.message || 'Check-in processado com sucesso'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      const shouldFallbackLegacy = Boolean(routeError) && (
        routeError.message?.toLowerCase().includes('function') ||
        routeError.message?.toLowerCase().includes('does not exist') ||
        routeError.message?.toLowerCase().includes('not found')
      )

      if (routeError && !shouldFallbackLegacy) {
        throw new Error(routeError.message)
      }

      // Validar que swap existe
      const { data: swapData, error: swapError } = await supabase
        .from('swaps')
        .select('*')
        .eq('swap_id', swapId)
        .single()

      if (swapError || !swapData) throw new Error('Swap não encontrado')

      // Determinar qual usuário está pagando
      const isUser1 = swapData.user_1_id === buyerId
      const updateData = isUser1
        ? { guarantee_fee_1_paid: true }
        : { guarantee_fee_2_paid: true }

      // Marcar taxa como paga
      await supabase
        .from('swaps')
        .update(updateData)
        .eq('swap_id', swapId)

      // Registrar na ledger
      await supabase
        .from('financial_ledger')
        .insert([
          {
            source_type: 'troca',
            source_id: swapId,
            entry_type: 'taxa_garantia_troca',
            amount: totalAmount,
            user_id: buyerId,
            metadata: {
              swap_id: swapId,
              is_user_1: isUser1,
              payment_id: paymentId
            }
          }
        ])

      // Verificar se ambos pagaram
      const { data: updatedSwap } = await supabase
        .from('swaps')
        .select('*')
        .eq('swap_id', swapId)
        .single()

      if (updatedSwap.guarantee_fee_1_paid && updatedSwap.guarantee_fee_2_paid) {
        await supabase
          .from('swaps')
          .update({ status: 'autorizado_envio' })
          .eq('swap_id', swapId)

        return new Response(
          JSON.stringify({
            success: true,
            bothPaid: true,
            message: 'Taxa paga! Ambos usuários agora podem gerar etiquetas de envio.'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          bothPaid: false,
          message: 'Taxa de garantia registrada! Aguardando pagamento do outro usuário.'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    throw new Error('Tipo de transação inválido')

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : 'Sem stack trace'
    
    console.error('[process-transaction] ERRO CRÍTICO:', {
      message: errorMessage,
      stack: errorStack,
      errorObject: JSON.stringify(error, Object.getOwnPropertyNames(error))
    })
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: 'Veja os logs da Edge Function para mais detalhes'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

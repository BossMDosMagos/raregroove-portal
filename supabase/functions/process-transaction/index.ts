// Supabase Edge Function para processar transação após pagamento aprovado
// Deploy: supabase functions deploy process-transaction

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    console.log('[process-transaction] Payload recebido:', JSON.stringify(body, null, 2))

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
      swapId
    } = body

    console.log('[process-transaction] Variáveis extraídas:', {
      transactionType,
      buyerId,
      paymentId,
      itemPrice,
      totalAmount
    })

    // Validar dados obrigatórios
    if (!buyerId || !paymentId) {
      console.error('[process-transaction] Erro: dados obrigatórios faltando', { buyerId: !!buyerId, paymentId: !!paymentId })
      throw new Error('Dados obrigatórios faltando: buyerId ou paymentId')
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
      
      console.log('[process-transaction] Tentando inserir transação com dados:', JSON.stringify(transactionData, null, 2))
      
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert([transactionData])
        .select()
        .single()

      if (txError) {
        console.error('[process-transaction] Erro ao inserir transação:', {
          code: txError.code,
          message: txError.message,
          details: txError.details,
          hint: txError.hint
        })
        throw txError
      }

      console.log('[process-transaction] Transação criada com sucesso:', transaction.id)

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
              amount: totalAmount,
              user_id: null,
              metadata: {
                item_id: itemId,
                buyer_id: buyerId,
                total_amount: totalAmount,
                payment_id: paymentId,
                description: 'Venda direta do portal - 100% receita'
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
              amount: netAmount,
              user_id: sellerId,
              metadata: {
                item_id: itemId,
                buyer_id: buyerId,
                platform_fee: platformFee,
                gateway_fee: gatewayFee,
                payment_id: paymentId
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

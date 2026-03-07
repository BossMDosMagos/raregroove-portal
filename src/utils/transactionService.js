import { supabase } from '../lib/supabase';

/**
 * Serviço de Transações
 * Gerencia fluxo de pagamento, criação de transações e marcação de itens como vendidos
 */

/**
 * Processar pagamento e criar transação
 * Chamado após aprovação do gateway de pagamento
 */
export const processPayment = async ({
  buyerId,
  sellerId,
  itemId,
  itemPrice,
  shippingCost,
  insuranceCost,
  platformFeePercentage,
  processingFeeFixed,
  gatewayFeePercentage,
  paymentMethod,
  shippingData
}) => {
  try {
    // Calcular taxas
    const platformFee = parseFloat((itemPrice * platformFeePercentage / 100).toFixed(2));
    const processingFee = processingFeeFixed || 2.0;
    const gatewayFee = parseFloat((itemPrice * gatewayFeePercentage / 100).toFixed(2));
    const totalAmount = itemPrice + shippingCost + insuranceCost + processingFee + gatewayFee;
    const netAmount = itemPrice - platformFee; // O que o vendedor recebe (bruto)

    // 1. Criar registro na tabela transactions
    const { data: transactionData, error: transactionError } = await supabase
      .from('transactions')
      .insert([
        {
          buyer_id: buyerId,
          seller_id: sellerId,
          item_id: itemId,
          transaction_type: 'venda',
          price: itemPrice,
          platform_fee: platformFee,
          gateway_fee: gatewayFee,
          total_amount: totalAmount,
          net_amount: netAmount,
          shipping_cost: shippingCost,
          insurance_cost: insuranceCost,
          status: 'pago_em_custodia',
          payment_method: paymentMethod,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (transactionError) throw transactionError;

    // 2. Criar registro de shipping
    let shippingId = null;
    if (shippingData) {
      const { data: shipData, error: shipError } = await supabase
        .from('shipping')
        .insert([
          {
            transaction_id: transactionData.id,
            buyer_id: buyerId,
            seller_id: sellerId,
            item_id: itemId,
            from_cep: shippingData.fromCep,
            from_address: shippingData.fromAddress || {},
            to_cep: shippingData.toCep,
            to_address: shippingData.toAddress || {},
            estimated_cost: shippingCost,
            has_insurance: insuranceCost > 0,
            insurance_cost: insuranceCost,
            carrier: shippingData.carrier || 'correios',
            status: 'awaiting_label'
          }
        ])
        .select()
        .single();

      if (shipError) throw shipError;
      shippingId = shipData.shipping_id;

      // Atualizar transação com shipping_id
      await supabase
        .from('transactions')
        .update({ shipping_id: shippingId })
        .eq('id', transactionData.id);
    }

    // 3. Marcar item como vendido
    const { error: itemError } = await supabase
      .from('items')
      .update({
        is_sold: true,
        sold_to_user_id: buyerId,
        sold_at: new Date().toISOString()
      })
      .eq('id', itemId);

    if (itemError) throw itemError;

    // 4. Adicionar valor à custódia do vendedor (user_balances)
    await ensureUserBalance(sellerId);

    const { error: balanceError } = await supabase
      .from('user_balances')
      .update({
        pending_balance: supabase.raw(`pending_balance + ${netAmount}`)
      })
      .eq('user_id', sellerId);

    if (balanceError) throw balanceError;

    // 5. Registrar na ledger financeira
    await supabase
      .from('financial_ledger')
      .insert([
        {
          source_type: 'venda',
          source_id: transactionData.id,
          entry_type: 'venda_realizada',
          amount: netAmount,
          user_id: sellerId,
          metadata: {
            item_id: itemId,
            buyer_id: buyerId,
            platform_fee: platformFee,
            gateway_fee: gatewayFee,
            shipping_cost: shippingCost
          }
        }
      ]);

    return {
      success: true,
      transactionId: transactionData.id,
      shippingId: shippingId,
      transaction: transactionData,
      netAmount: netAmount
    };
  } catch (error) {
    console.error('Erro ao processar pagamento:', error);
    throw error;
  }
};

/**
 * Processar swap (troca segura)
 * Ambos os usuários devem pagar a taxa de garantia
 */
export const processSwapPayment = async ({
  swapId,
  userId,
  swapGuaranteeAmount,
  platformSettings
}) => {
  try {
    // Validar que swap existe e está pendente
    const { data: swapData, error: swapError } = await supabase
      .from('swaps')
      .select('*')
      .eq('swap_id', swapId)
      .single();

    if (swapError || !swapData) throw new Error('Swap não encontrado');

    if (swapData.status !== 'aguardando_taxas') {
      throw new Error('Swap não está mais aguardando taxas');
    }

    // Determinar qual usuário está pagando
    const isUser1 = swapData.user_1_id === userId;
    const updateData = isUser1
      ? { guarantee_fee_1_paid: true }
      : { guarantee_fee_2_paid: true };

    // 1. Marcar taxa como paga
    const { error: updateError } = await supabase
      .from('swaps')
      .update(updateData)
      .eq('swap_id', swapId);

    if (updateError) throw updateError;

    // 2. Descontar valor da custódia do usuário
    await ensureUserBalance(userId);

    await supabase.rpc('deduct_from_balance', {
      p_user_id: userId,
      p_amount: swapGuaranteeAmount
    });

    // 3. Registrar na ledger
    await supabase
      .from('financial_ledger')
      .insert([
        {
          source_type: 'troca',
          source_id: swapId,
          entry_type: 'taxa_garantia_troca',
          amount: swapGuaranteeAmount,
          user_id: userId,
          metadata: {
            swap_id: swapId,
            is_user_1: isUser1
          }
        }
      ]);

    // 4. Verificar se ambos pagaram - se sim, muda status
    const { data: updatedSwap } = await supabase
      .from('swaps')
      .select('*')
      .eq('swap_id', swapId)
      .single();

    if (updatedSwap.guarantee_fee_1_paid && updatedSwap.guarantee_fee_2_paid) {
      await supabase
        .from('swaps')
        .update({ status: 'autorizado_envio' })
        .eq('swap_id', swapId);

      return {
        success: true,
        bothPaid: true,
        message: 'Taxa paga! Aguardando confirmação do outro usuário...'
      };
    }

    return {
      success: true,
      bothPaid: false,
      message: 'Taxa de garantia registrada!'
    };
  } catch (error) {
    console.error('Erro ao processar taxa de swap:', error);
    throw error;
  }
};

/**
 * Garantir que usuário tem registro em user_balances
 */
export const ensureUserBalance = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_balances')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!data) {
      await supabase
        .from('user_balances')
        .insert([
          {
            user_id: userId,
            available_balance: 0,
            pending_balance: 0
          }
        ]);
    }
  } catch (error) {
    // Usuário pode já ter o registro
    console.log('Erro ao garantir balance (pode ser normal):', error.message);
  }
};

/**
 * Getrocar itens após ambos confirmarem entrega
 * Marca os itens como trocados e faz reversão de saldos
 */
export const completeSwap = async (swapId) => {
  try {
    // TODO: Implementar lógica completa de conclusão de troca
    // Por agora, apenas atualiza status

    const { data, error } = await supabase
      .from('swaps')
      .update({ status: 'concluido', completed_at: new Date().toISOString() })
      .eq('swap_id', swapId)
      .select()
      .single();

    if (error) throw error;

    // Registrar na ledger que troca foi concluída
    await supabase
      .from('financial_ledger')
      .insert([
        {
          source_type: 'troca',
          source_id: swapId,
          entry_type: 'troca_concluida',
          amount: 0,
          metadata: { swap_id: swapId }
        }
      ]);

    return data;
  } catch (error) {
    console.error('Erro ao completar troca:', error);
    throw error;
  }
};

/**
 * Cancelar transação e reembolsar
 */
export const cancelTransaction = async (transactionId, reason) => {
  try {
    const { data: transaction, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (fetchError) throw fetchError;

    // 1. Atualizar status para cancelado
    await supabase
      .from('transactions')
      .update({ status: 'cancelado' })
      .eq('id', transactionId);

    // 2. Reverter item de "vendido"
    await supabase
      .from('items')
      .update({ is_sold: false, sold_to_user_id: null })
      .eq('id', transaction.item_id);

    // 3. Reembolsar saldo do vendedor
    await supabase
      .from('user_balances')
      .update({
        pending_balance: supabase.raw(`pending_balance - ${transaction.net_amount}`)
      })
      .eq('user_id', transaction.seller_id);

    // 4. Registrar cancelamento na ledger
    await supabase
      .from('financial_ledger')
      .insert([
        {
          source_type: 'venda',
          source_id: transactionId,
          entry_type: 'cancelamento',
          amount: -transaction.net_amount,
          user_id: transaction.seller_id,
          metadata: {
            reason: reason
          }
        }
      ]);

    return { success: true };
  } catch (error) {
    console.error('Erro ao cancelar transação:', error);
    throw error;
  }
};

export default {
  processPayment,
  processSwapPayment,
  ensureUserBalance,
  completeSwap,
  cancelTransaction
};

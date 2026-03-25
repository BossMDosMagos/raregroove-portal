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
  const platformFee = parseFloat((itemPrice * platformFeePercentage / 100).toFixed(2));
  const processingFee = processingFeeFixed || 2.0;
  const gatewayFee = parseFloat((itemPrice * gatewayFeePercentage / 100).toFixed(2));
  const totalAmount = itemPrice + shippingCost + insuranceCost + processingFee + gatewayFee;
  const netAmount = itemPrice - platformFee;

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

    // Usar RPC para evitar SQL injection
    const { error: balanceError } = await supabase.rpc('add_pending_balance', {
      p_user_id: sellerId,
      p_amount: netAmount
    });

    if (balanceError) {
      // Fallback seguro se RPC não existir
      const { data: current } = await supabase
        .from('user_balances')
        .select('pending_balance')
        .eq('user_id', sellerId)
        .single();
      
      const newBalance = (current?.pending_balance || 0) + netAmount;
      await supabase
        .from('user_balances')
        .update({ pending_balance: newBalance })
        .eq('user_id', sellerId);
    }

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
  const { data: swapData, error: swapError } = await supabase
    .from('swaps')
    .select('*')
    .eq('swap_id', swapId)
    .single();

  if (swapError || !swapData) throw new Error('Swap não encontrado');

  if (swapData.status !== 'aguardando_taxas') {
    throw new Error('Swap não está mais aguardando taxas');
  }

  const isUser1 = swapData.user_1_id === userId;
  const updateData = isUser1
    ? { guarantee_fee_1_paid: true }
    : { guarantee_fee_2_paid: true };

  const { error: updateError } = await supabase
    .from('swaps')
    .update(updateData)
    .eq('swap_id', swapId);

  if (updateError) throw updateError;

  await ensureUserBalance(userId);

  await supabase.rpc('deduct_from_balance', {
    p_user_id: userId,
    p_amount: swapGuaranteeAmount
  });

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
};

/**
 * Garantir que usuário tem registro em user_balances
 */
export const ensureUserBalance = async (userId) => {
  try {
    const { data } = await supabase
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
  } catch {
    // Usuário pode já ter o registro
  }
};

/**
 * Getrocar itens após ambos confirmarem entrega
 * Marca os itens como trocados e faz reversão de saldos
 */
export const completeSwap = async (swapId) => {
  const { data, error } = await supabase
    .from('swaps')
    .update({ status: 'concluido', completed_at: new Date().toISOString() })
    .eq('swap_id', swapId)
    .select()
    .single();

  if (error) throw error;

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
};

/**
 * Cancelar transação e reembolsar
 */
export const cancelTransaction = async (transactionId, reason) => {
  const { data: transaction, error: fetchError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .single();

  if (fetchError) throw fetchError;

  await supabase
    .from('transactions')
    .update({ status: 'cancelado' })
    .eq('id', transactionId);

  await supabase
    .from('items')
    .update({ is_sold: false, sold_to_user_id: null })
    .eq('id', transaction.item_id);

  const { error: refundError } = await supabase.rpc('subtract_pending_balance', {
    p_user_id: transaction.seller_id,
    p_amount: transaction.net_amount
  });

  if (refundError) {
    const { data: current } = await supabase
      .from('user_balances')
      .select('pending_balance')
      .eq('user_id', transaction.seller_id)
      .single();
    
    const newBalance = Math.max(0, (current?.pending_balance || 0) - transaction.net_amount);
    await supabase
      .from('user_balances')
      .update({ pending_balance: newBalance })
      .eq('user_id', transaction.seller_id);
  }

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
};

export default {
  processPayment,
  processSwapPayment,
  ensureUserBalance,
  completeSwap,
  cancelTransaction
};

import { supabase } from '../lib/supabase';

/**
 * Garante que o usuário possui registro em user_balances.
 * Usado ao preparar saldos para operações financeiras.
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
    // Registro pode já existir ou tabela pode não estar disponível
  }
};

export default {
  ensureUserBalance,
};

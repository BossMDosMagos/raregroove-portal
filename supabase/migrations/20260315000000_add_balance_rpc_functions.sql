-- Funções RPC para manipulação segura de saldo
-- Execute este SQL no Supabase SQL Editor

-- ==============================================================================
-- FUNÇÃO: add_pending_balance
-- Adiciona valor ao saldo pendente de um usuário ( thread-safe )
-- ==============================================================================
CREATE OR REPLACE FUNCTION add_pending_balance(
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  -- Validar parâmetros
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User ID é obrigatório');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valor deve ser maior que zero');
  END IF;

  -- Verificar se usuário existe
  IF NOT EXISTS (SELECT 1 FROM user_balances WHERE user_id = p_user_id) THEN
    -- Criar registro de saldo se não existir
    INSERT INTO user_balances (user_id, available_balance, pending_balance)
    VALUES (p_user_id, 0, p_amount)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Obter saldo atual com lock
  SELECT pending_balance INTO v_current_balance
  FROM user_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Calcular novo saldo
  v_new_balance := COALESCE(v_current_balance, 0) + p_amount;

  -- Atualizar saldo
  UPDATE user_balances
  SET pending_balance = v_new_balance,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'amount_added', p_amount,
    'new_pending_balance', v_new_balance
  );
END;
$$;

-- ==============================================================================
-- FUNÇÃO: subtract_pending_balance
-- Subtrai valor do saldo pendente de um usuário ( thread-safe )
-- ==============================================================================
CREATE OR REPLACE FUNCTION subtract_pending_balance(
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  -- Validar parâmetros
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User ID é obrigatório');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valor deve ser maior que zero');
  END IF;

  -- Verificar se usuário tem saldo
  IF NOT EXISTS (SELECT 1 FROM user_balances WHERE user_id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não tem saldo');
  END IF;

  -- Obter saldo atual com lock
  SELECT pending_balance INTO v_current_balance
  FROM user_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Verificar se tem saldo suficiente
  IF COALESCE(v_current_balance, 0) < p_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Saldo insuficiente',
      'current_balance', v_current_balance,
      'requested_amount', p_amount
    );
  END IF;

  -- Calcular novo saldo
  v_new_balance := v_current_balance - p_amount;

  -- Atualizar saldo
  UPDATE user_balances
  SET pending_balance = v_new_balance,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'amount_subtracted', p_amount,
    'new_pending_balance', v_new_balance
  );
END;
$$;

-- ==============================================================================
-- FUNÇÃO: release_item_reservation (não recriar - já existe)
-- Apenas garante permissões
-- ==============================================================================

-- ==============================================================================
-- GRANT permissões para as funções
-- ==============================================================================
GRANT EXECUTE ON FUNCTION add_pending_balance TO service_role;
GRANT EXECUTE ON FUNCTION add_pending_balance TO authenticated;

GRANT EXECUTE ON FUNCTION subtract_pending_balance TO service_role;
GRANT EXECUTE ON FUNCTION subtract_pending_balance TO authenticated;

GRANT EXECUTE ON FUNCTION release_item_reservation TO service_role;
GRANT EXECUTE ON FUNCTION release_item_reservation TO authenticated;

-- Verificar se.functions foram criadas
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND routine_name IN ('add_pending_balance', 'subtract_pending_balance', 'release_item_reservation');

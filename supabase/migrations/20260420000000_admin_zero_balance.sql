-- Função RPC para admin zerar saldo de user_balances
-- Executar este SQL no Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.admin_zero_balance(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verifica se é admin via is_admin_user
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem zerar saldos';
  END IF;

  -- Atualiza o saldo para zero
  UPDATE public.user_balances
  SET available_balance = 0, 
      pending_balance = 0, 
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$$;
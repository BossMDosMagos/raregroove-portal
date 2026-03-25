-- =============================================================================
-- RAREGROOVE | FIX SAQUE ÚNICO + SAQUE DE SALDO TOTAL
-- Data: 2026-03-05
-- Objetivo:
-- 1) Bloquear múltiplas solicitações ativas (pendente/processando) por usuário
-- 2) Forçar create_withdrawal a usar sempre o saldo total disponível
-- =============================================================================

BEGIN;

-- Higienização: manter apenas 1 solicitação ativa por usuário
WITH ranked_active AS (
  SELECT
    w.id,
    ROW_NUMBER() OVER (
      PARTITION BY w.user_id
      ORDER BY w.requested_at DESC NULLS LAST, w.id DESC
    ) AS rn
  FROM public.withdrawals w
  WHERE w.status IN ('pendente', 'processando')
)
UPDATE public.withdrawals w
SET status = 'cancelado'
FROM ranked_active r
WHERE w.id = r.id
  AND r.rn > 1;

-- Trava estrutural contra duplicidade de solicitação ativa
CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawals_user_single_active
ON public.withdrawals (user_id)
WHERE status IN ('pendente', 'processando');

-- Reforço de regra de negócio no backend
CREATE OR REPLACE FUNCTION public.create_withdrawal(
  user_uuid uuid,
  amount decimal,
  pix_key text
)
RETURNS TABLE(
  success boolean,
  message text,
  withdrawal_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_balance numeric;
  withdrawal_amount numeric;
  existing_withdrawal_id uuid;
  new_withdrawal_id uuid;
BEGIN
  -- Bloquear solicitação duplicada enquanto houver saque ativo
  SELECT w.id
    INTO existing_withdrawal_id
  FROM public.withdrawals w
  WHERE w.user_id = user_uuid
    AND w.status IN ('pendente', 'processando')
  ORDER BY w.requested_at DESC NULLS LAST
  LIMIT 1;

  IF existing_withdrawal_id IS NOT NULL THEN
    RETURN QUERY SELECT false, 'Você já possui um saque em análise.', existing_withdrawal_id;
    RETURN;
  END IF;

  IF pix_key IS NULL OR btrim(pix_key) = '' THEN
    RETURN QUERY SELECT false, 'Cadastre uma chave PIX válida antes de solicitar saque.', NULL::uuid;
    RETURN;
  END IF;

  -- Sempre usa saldo total disponível (ignora valor fracionado enviado pelo frontend)
  SELECT COALESCE(f.saldo_disponivel, 0)
    INTO user_balance
  FROM public.get_user_financials(user_uuid) f;

  withdrawal_amount := user_balance;

  IF withdrawal_amount < 10 THEN
    RETURN QUERY SELECT false, 'Saldo mínimo para saque: R$ 10,00', NULL::uuid;
    RETURN;
  END IF;

  INSERT INTO public.withdrawals (user_id, amount, pix_key, status)
  VALUES (user_uuid, withdrawal_amount, pix_key, 'pendente')
  RETURNING id INTO new_withdrawal_id;

  RETURN QUERY SELECT true, 'Solicitação enviada com sucesso. Valor total do saldo encaminhado para saque.', new_withdrawal_id;
END;
$$;

COMMENT ON FUNCTION public.create_withdrawal(uuid, decimal, text)
IS 'Cria solicitação única de saque por usuário (status ativo) e força uso do saldo total disponível.';

COMMIT;

-- Verificação rápida:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public' AND tablename = 'withdrawals' AND indexname = 'idx_withdrawals_user_single_active';

-- =============================================================================
-- RAREGROOVE | FIX LÓGICA DE SAQUE: RESERVAR SALDO IMEDIATAMENTE
-- Data: 2026-03-05
-- Objetivo: 
-- 1) Saldo_disponível = vendas_concluidas - saques_em_analise
-- 2) Bloqueio automático do botão quando saque em análise
-- 3) Impossibilidade de criar saque duplicado pois saldo fica zerado
-- =============================================================================

BEGIN;

-- 1. Recalcular get_user_financials para descontar saques em análise
CREATE OR REPLACE FUNCTION public.get_user_financials(user_uuid uuid)
RETURNS TABLE(
  saldo_disponivel decimal,
  saldo_pendente decimal,
  total_vendas bigint,
  vendas_concluidas bigint,
  vendas_em_andamento bigint,
  ticket_medio decimal,
  total_recebido decimal,
  comissao_plataforma decimal
) AS $$
DECLARE
  total_completed decimal;
  total_withdrawals_active decimal;
BEGIN
  -- Calcular total de vendas concluídas
  SELECT COALESCE(SUM(price), 0)::decimal
    INTO total_completed
  FROM public.transactions
  WHERE seller_id = user_uuid
    AND status = 'concluido';

  -- Calcular total de saques bloqueados: em análise OU já aprovados/processados
  -- (Só voltam ao disponível se cancelados)
  SELECT COALESCE(SUM(amount), 0)::decimal
    INTO total_withdrawals_active
  FROM public.withdrawals
  WHERE user_id = user_uuid
    AND status IN ('pendente', 'processando', 'concluido');

  -- Retornar com saldo reservado
  RETURN QUERY
  WITH transactions_data AS (
    SELECT 
      t.id,
      t.status,
      t.price,
      t.created_at
    FROM public.transactions t
    WHERE t.seller_id = user_uuid
  )
  SELECT 
    -- Saldo Disponível: vendas concluídas MENOS saques em análise
    (total_completed - total_withdrawals_active)::decimal as saldo_disponivel,
    
    -- Saldo Pendente: vendas pagas mas não enviadas/concluídas
    COALESCE(SUM(price) FILTER (WHERE status IN ('pendente', 'pago', 'enviado')), 0)::decimal as saldo_pendente,
    
    -- Total de Vendas (todas)
    COUNT(*)::bigint as total_vendas,
    
    -- Vendas Concluídas
    COUNT(*) FILTER (WHERE status = 'concluido')::bigint as vendas_concluidas,
    
    -- Vendas em Andamento
    COUNT(*) FILTER (WHERE status NOT IN ('concluido', 'cancelado'))::bigint as vendas_em_andamento,
    
    -- Ticket Médio
    COALESCE(AVG(price) FILTER (WHERE status = 'concluido'), 0)::decimal as ticket_medio,
    
    -- Total Recebido
    COALESCE(SUM(price) FILTER (WHERE status = 'concluido'), 0)::decimal as total_recebido,
    
    -- Comissão da Plataforma (5% das vendas concluídas)
    COALESCE(SUM(price * 0.05) FILTER (WHERE status = 'concluido'), 0)::decimal as comissao_plataforma
    
  FROM transactions_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.get_user_financials(uuid) IS 'Calcula financeiro do vendedor descontando saques em análise do saldo disponível';

-- 2. Duplicar proteção na função create_withdrawal com validação rigorosa
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
    RETURN QUERY SELECT false, 'Você já possui um saque em análise. Aguarde o processamento.', existing_withdrawal_id;
    RETURN;
  END IF;

  IF pix_key IS NULL OR btrim(pix_key) = '' THEN
    RETURN QUERY SELECT false, 'Cadastre uma chave PIX válida antes de solicitar saque.', NULL::uuid;
    RETURN;
  END IF;

  -- Usar saldo calculado pela função financeira (já desconta saques ativos)
  SELECT COALESCE(f.saldo_disponivel, 0)
    INTO user_balance
  FROM public.get_user_financials(user_uuid) f;

  withdrawal_amount := user_balance;

  -- Bloquear se saldo insuficiente (incluindo os já em análise)
  IF withdrawal_amount < 10 THEN
    RETURN QUERY SELECT false, 'Saldo insuficiente para saque (mínimo: R$ 10,00). Há saques em processamento bloqueando seu saldo?', NULL::uuid;
    RETURN;
  END IF;

  -- Tentar inserir com constraint de unicidade (segurança contra race condition)
  BEGIN
    INSERT INTO public.withdrawals (user_id, amount, pix_key, status)
    VALUES (user_uuid, withdrawal_amount, pix_key, 'pendente')
    RETURNING id INTO new_withdrawal_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY SELECT false, 'Falha: você tentou criar um saque duplicado. Isto foi impedido pela segurança do sistema.', NULL::uuid;
    RETURN;
  END;

  RETURN QUERY SELECT true, 'Solicitação enviada com sucesso. Seu saldo foi reservado e não está mais disponível para novo saque.', new_withdrawal_id;
END;
$$;

COMMENT ON FUNCTION public.create_withdrawal(uuid, decimal, text)
IS 'Cria solicitação única de saque com saldo imediatamente reservado. Impossibilita duplicação automática.';

COMMIT;

-- Verificação rápida:
-- SELECT * FROM public.get_user_financials('USER_UUID_AQUI');
-- SELECT COUNT(*) FROM public.withdrawals WHERE user_id = 'USER_UUID_AQUI' AND status IN ('pendente', 'processando');

-- Testes de cenários críticos:
-- 1. Usuário solicita saque de R$ 135 → saldo_disponível cai para R$ 0
-- 2. Usuário tenta solicitar novo saque → retorna erro "já possui saque em análise"
-- 3. Admin cancela saque → saldo volta a R$ 135
-- 4. Usuário recebe nova venda de R$ 50 → saldo fica R$ 50 (novo)
-- 5. Usuário solicita novo saque → cria saque de R$ 50 (só o novo saldo)
-- 6. Admin aprova primeiro saque com status 'concluido' → dinheiro foi pro PIX, saldo não volta
-- 7. Even após varios ciclos, impossível duplicar ou fragmentar saldo

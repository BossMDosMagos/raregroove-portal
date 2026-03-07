-- ========================================
-- DASHBOARD FINANCEIRO - RAREGROOVE
-- ========================================
-- Sistema completo de gestão de vendas e recebíveis

-- 1. Função RPC para calcular dados financeiros do usuário
CREATE OR REPLACE FUNCTION get_user_financials(user_uuid uuid)
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
BEGIN
  RETURN QUERY
  WITH transactions_data AS (
    SELECT 
      t.id,
      t.status,
      t.price,
      t.platform_fee,
      t.created_at
    FROM transactions t
    WHERE t.seller_id = user_uuid
  ),
  balances AS (
    SELECT available_balance, pending_balance
    FROM user_balances
    WHERE user_id = user_uuid
  )
  SELECT 
    -- Saldo Disponível: fonte oficial dos saldos
    COALESCE((SELECT available_balance FROM balances), 0)::decimal as saldo_disponivel,
    
    -- Saldo Pendente: fonte oficial dos saldos
    COALESCE((SELECT pending_balance FROM balances), 0)::decimal as saldo_pendente,
    
    -- Total de Vendas (todas)
    COUNT(*)::bigint as total_vendas,
    
    -- Vendas Concluídas
    COUNT(*) FILTER (WHERE status = 'concluido')::bigint as vendas_concluidas,
    
    -- Vendas em Andamento (não canceladas nem concluídas)
    COUNT(*) FILTER (WHERE status NOT IN ('concluido', 'cancelado'))::bigint as vendas_em_andamento,
    
    -- Ticket Médio (média do preço de vendas concluídas)
    COALESCE(AVG(price) FILTER (WHERE status = 'concluido'), 0)::decimal as ticket_medio,
    
    -- Total Recebido (soma de todas concluídas)
    COALESCE(SUM(price) FILTER (WHERE status = 'concluido'), 0)::decimal as total_recebido,
    
    -- Comissão da Plataforma (usa platform_fee gravado)
    COALESCE(SUM(platform_fee) FILTER (WHERE status = 'concluido'), 0)::decimal as comissao_plataforma
    
  FROM transactions_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Função para listar recebíveis (transações detalhadas)
CREATE OR REPLACE FUNCTION get_user_receivables(user_uuid uuid, limit_rows integer DEFAULT 10)
RETURNS TABLE(
  transaction_id uuid,
  item_id uuid,
  item_title text,
  item_image_url text,
  buyer_id uuid,
  buyer_name text,
  buyer_avatar text,
  price decimal,
  status text,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as transaction_id,
    t.item_id,
    i.title as item_title,
    i.image_url as item_image_url,
    t.buyer_id,
    p.full_name as buyer_name,
    p.avatar_url as buyer_avatar,
    t.price,
    t.status,
    t.created_at,
    t.updated_at
  FROM transactions t
  JOIN items i ON i.id = t.item_id
  JOIN profiles p ON p.id = t.buyer_id
  WHERE t.seller_id = user_uuid
  ORDER BY t.created_at DESC
  LIMIT limit_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Função para listar histórico de compras do usuário
CREATE OR REPLACE FUNCTION get_user_purchases(user_uuid uuid, limit_rows integer DEFAULT 10)
RETURNS TABLE(
  transaction_id uuid,
  item_id uuid,
  item_title text,
  item_image_url text,
  seller_id uuid,
  seller_name text,
  seller_avatar text,
  price decimal,
  status text,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as transaction_id,
    t.item_id,
    i.title as item_title,
    i.image_url as item_image_url,
    t.seller_id,
    p.full_name as seller_name,
    p.avatar_url as seller_avatar,
    t.price,
    t.status,
    t.created_at,
    t.updated_at
  FROM transactions t
  JOIN items i ON i.id = t.item_id
  JOIN profiles p ON p.id = t.seller_id
  WHERE t.buyer_id = user_uuid
  ORDER BY t.created_at DESC
  LIMIT limit_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. View materializada para ranking de vendedores
CREATE MATERIALIZED VIEW IF NOT EXISTS seller_rankings AS
SELECT 
  p.id as seller_id,
  p.full_name,
  p.avatar_url,
  COUNT(t.id) as total_vendas,
  SUM(t.price) as receita_total,
  AVG(t.price) as ticket_medio,
  COUNT(t.id) FILTER (WHERE t.status = 'concluido') as vendas_concluidas,
  COALESCE(AVG(r.rating), 0) as rating_medio
FROM profiles p
LEFT JOIN transactions t ON t.seller_id = p.id AND t.status = 'concluido'
LEFT JOIN reviews r ON r.reviewed_id = p.id
GROUP BY p.id, p.full_name, p.avatar_url
HAVING COUNT(t.id) > 0
ORDER BY receita_total DESC;

-- Criar índice único
CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_rankings_seller_id 
  ON seller_rankings(seller_id);

-- 5. Função para atualizar view de rankings
CREATE OR REPLACE FUNCTION refresh_seller_rankings()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY seller_rankings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Função para simular solicitação de saque
CREATE OR REPLACE FUNCTION request_withdrawal(
  user_uuid uuid,
  amount decimal,
  pix_key text
)
RETURNS TABLE(
  success boolean,
  message text,
  withdrawal_id uuid
) AS $$
DECLARE
  user_balance decimal;
  new_withdrawal_id uuid;
BEGIN
  -- Verificar saldo disponível
  SELECT saldo_disponivel INTO user_balance
  FROM get_user_financials(user_uuid);
  
  IF user_balance < amount THEN
    RETURN QUERY SELECT false, 'Saldo insuficiente', NULL::uuid;
    RETURN;
  END IF;
  
  IF amount < 10.00 THEN
    RETURN QUERY SELECT false, 'Valor mínimo para saque é R$ 10,00', NULL::uuid;
    RETURN;
  END IF;
  
  -- Criar registro de saque (você pode criar uma tabela withdrawals depois)
  -- Por enquanto, apenas simular
  new_withdrawal_id := gen_random_uuid();
  
  RETURN QUERY SELECT 
    true, 
    'Solicitação de saque enviada! Processaremos em até 2 dias úteis.', 
    new_withdrawal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Tabela de saques (opcional para controle administrativo)
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount decimal(10, 2) NOT NULL CHECK (amount >= 10.00),
  pix_key text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'concluido', 'cancelado')),
  requested_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON public.withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);

-- RLS
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- Usuários veem apenas seus saques
DROP POLICY IF EXISTS "Usuários veem seus saques" ON public.withdrawals;
CREATE POLICY "Usuários veem seus saques"
  ON public.withdrawals
  FOR SELECT
  USING (auth.uid() = user_id);

-- Usuários criam seus saques
DROP POLICY IF EXISTS "Usuários criam saques" ON public.withdrawals;
CREATE POLICY "Usuários criam saques"
  ON public.withdrawals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 8. Função para criar saque na tabela
CREATE OR REPLACE FUNCTION create_withdrawal(
  user_uuid uuid,
  amount decimal,
  pix_key text
)
RETURNS TABLE(
  success boolean,
  message text,
  withdrawal_id uuid
) AS $$
DECLARE
  user_balance decimal;
  new_withdrawal_id uuid;
BEGIN
  -- Verificar saldo
  SELECT saldo_disponivel INTO user_balance
  FROM get_user_financials(user_uuid);
  
  IF user_balance < amount THEN
    RETURN QUERY SELECT false, 'Saldo insuficiente', NULL::uuid;
    RETURN;
  END IF;
  
  IF amount < 10.00 THEN
    RETURN QUERY SELECT false, 'Valor mínimo: R$ 10,00', NULL::uuid;
    RETURN;
  END IF;
  
  -- Inserir saque
  INSERT INTO withdrawals (user_id, amount, pix_key, status)
  VALUES (user_uuid, amount, pix_key, 'pendente')
  RETURNING id INTO new_withdrawal_id;
  
  RETURN QUERY SELECT 
    true, 
    'Solicitação enviada! Processaremos em até 2 dias úteis.', 
    new_withdrawal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Comentários de documentação
COMMENT ON FUNCTION get_user_financials IS 'Retorna dados financeiros completos do vendedor';
COMMENT ON FUNCTION get_user_receivables IS 'Lista transações de venda com detalhes';
COMMENT ON FUNCTION get_user_purchases IS 'Lista transações de compra com detalhes';
COMMENT ON FUNCTION create_withdrawal IS 'Cria solicitação de saque com validação de saldo';
COMMENT ON TABLE withdrawals IS 'Registro de solicitações de saque dos vendedores';

-- 10. Verificação final
SELECT 
  '✅ Função get_user_financials criada: ' || 
  CASE 
    WHEN EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'get_user_financials')
    THEN 'SIM'
    ELSE 'NÃO'
  END as funcao_financials;

SELECT 
  '✅ Função get_user_receivables criada: ' ||
  CASE 
    WHEN EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'get_user_receivables')
    THEN 'SIM'
    ELSE 'NÃO'
  END as funcao_receivables;

SELECT 
  '✅ Tabela withdrawals criada: ' ||
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'withdrawals')
    THEN 'SIM'
    ELSE 'NÃO'
  END as tabela_withdrawals;

SELECT 
  '✅ View seller_rankings criada: ' ||
  CASE 
    WHEN EXISTS(SELECT 1 FROM pg_matviews WHERE matviewname = 'seller_rankings')
    THEN 'SIM'
    ELSE 'NÃO'
  END as view_rankings;

-- ========================================
-- 🎉 SISTEMA FINANCEIRO PRONTO!
-- ========================================
-- Próximos passos:
-- 1. Criar componente FinanceCard no frontend
-- 2. Criar modal de solicitação de saque
-- 3. Integrar no Profile
-- 4. Testar fluxo completo

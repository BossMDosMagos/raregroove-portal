-- ========================================
-- SISTEMA DE LOGÍSTICA E RASTREIO
-- ========================================
-- Adiciona tracking de envio e entrega às transações
-- Data: 25/02/2026
-- ========================================

-- 1️⃣ ADICIONAR COLUNAS DE RASTREIO
-- ========================================

ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS tracking_code TEXT,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_transactions_tracking 
  ON transactions(tracking_code) 
  WHERE tracking_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_shipped 
  ON transactions(shipped_at DESC) 
  WHERE shipped_at IS NOT NULL;

COMMENT ON COLUMN transactions.tracking_code IS 'Código de rastreio da transportadora (Correios, etc)';
COMMENT ON COLUMN transactions.shipped_at IS 'Data/hora em que o item foi enviado';
COMMENT ON COLUMN transactions.delivered_at IS 'Data/hora em que o comprador confirmou o recebimento';


-- 2️⃣ POLÍTICAS RLS PARA TRACKING
-- ========================================

-- Vendedor pode atualizar o código de rastreio
CREATE POLICY "Vendedor pode atualizar tracking_code"
  ON transactions FOR UPDATE
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- Comprador e Vendedor podem ler o tracking_code
CREATE POLICY "Comprador e vendedor podem ler tracking"
  ON transactions FOR SELECT
  USING (
    buyer_id = auth.uid() OR 
    seller_id = auth.uid()
  );


-- 3️⃣ FUNCTION: Adicionar Código de Rastreio
-- ========================================
-- Atualiza status para 'enviado' e notifica comprador

CREATE OR REPLACE FUNCTION add_tracking_code(
  p_transaction_id BIGINT,
  p_tracking_code TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction RECORD;
  v_buyer_name TEXT;
  v_result JSON;
BEGIN
  -- Verificar se a transação existe e é do vendedor
  SELECT * INTO v_transaction
  FROM transactions
  WHERE id = p_transaction_id 
    AND seller_id = auth.uid()
    AND status = 'pago';
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Transação não encontrada ou não pode ser enviada'
    );
  END IF;
  
  -- Validar código de rastreio
  IF p_tracking_code IS NULL OR TRIM(p_tracking_code) = '' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Código de rastreio inválido'
    );
  END IF;
  
  -- Atualizar transação
  UPDATE transactions
  SET 
    tracking_code = TRIM(UPPER(p_tracking_code)),
    shipped_at = NOW(),
    status = 'enviado'
  WHERE id = p_transaction_id;
  
  -- Buscar nome do comprador
  SELECT full_name INTO v_buyer_name
  FROM profiles
  WHERE id = v_transaction.buyer_id;
  
  -- Criar notificação para o comprador
  INSERT INTO notifications (user_id, type, title, message, link, data)
  VALUES (
    v_transaction.buyer_id,
    'transaction',
    '📦 Pedido Enviado!',
    'Seu pedido foi enviado. Código de rastreio: ' || TRIM(UPPER(p_tracking_code)),
    '/financials',
    json_build_object(
      'transaction_id', p_transaction_id,
      'tracking_code', TRIM(UPPER(p_tracking_code))
    )
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Código de rastreio adicionado com sucesso',
    'tracking_code', TRIM(UPPER(p_tracking_code)),
    'shipped_at', NOW()
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Erro: ' || SQLERRM
    );
END;
$$;


-- 4️⃣ FUNCTION: Confirmar Recebimento
-- ========================================
-- Comprador confirma recebimento, atualiza status para 'concluido'

CREATE OR REPLACE FUNCTION confirm_delivery(
  p_transaction_id BIGINT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction RECORD;
  v_seller_name TEXT;
  v_result JSON;
BEGIN
  -- Verificar se a transação existe e é do comprador
  SELECT * INTO v_transaction
  FROM transactions
  WHERE id = p_transaction_id 
    AND buyer_id = auth.uid()
    AND status = 'enviado';
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Transação não encontrada ou não pode ser confirmada'
    );
  END IF;
  
  -- Atualizar transação
  UPDATE transactions
  SET 
    delivered_at = NOW(),
    status = 'concluido'
  WHERE id = p_transaction_id;
  
  -- Buscar nome do vendedor
  SELECT full_name INTO v_seller_name
  FROM profiles
  WHERE id = v_transaction.seller_id;
  
  -- Criar notificação para o vendedor
  INSERT INTO notifications (user_id, type, title, message, link, data)
  VALUES (
    v_transaction.seller_id,
    'transaction',
    '✅ Venda Concluída!',
    'O comprador confirmou o recebimento. Saldo liberado!',
    '/financials',
    json_build_object(
      'transaction_id', p_transaction_id,
      'status', 'concluido'
    )
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Recebimento confirmado com sucesso!',
    'delivered_at', NOW()
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Erro: ' || SQLERRM
    );
END;
$$;


-- 5️⃣ ATUALIZAR VIEWS MATERIALIZADAS
-- ========================================
-- Adicionar tracking às views existentes

DROP MATERIALIZED VIEW IF EXISTS user_receivables;
DROP MATERIALIZED VIEW IF EXISTS user_purchases;

CREATE MATERIALIZED VIEW user_receivables AS
SELECT 
  t.seller_id AS user_id,
  t.id AS transaction_id,
  t.buyer_id,
  t.item_id,
  t.price,
  t.status,
  t.tracking_code,
  t.shipped_at,
  t.delivered_at,
  t.created_at,
  t.updated_at,
  p.full_name AS buyer_name,
  p.avatar_url AS buyer_avatar,
  i.title AS item_title,
  i.artist,
  i.image_url AS item_image_url
FROM transactions t
INNER JOIN profiles p ON p.id = t.buyer_id
INNER JOIN items i ON i.id = t.item_id
WHERE t.status != 'cancelado';

CREATE INDEX idx_user_receivables_user ON user_receivables(user_id);
CREATE INDEX idx_user_receivables_status ON user_receivables(status);

CREATE MATERIALIZED VIEW user_purchases AS
SELECT 
  t.buyer_id AS user_id,
  t.id AS transaction_id,
  t.seller_id,
  t.item_id,
  t.price,
  t.status,
  t.tracking_code,
  t.shipped_at,
  t.delivered_at,
  t.created_at,
  t.updated_at,
  p.full_name AS seller_name,
  p.avatar_url AS seller_avatar,
  i.title AS item_title,
  i.artist,
  i.image_url AS item_image_url
FROM transactions t
INNER JOIN profiles p ON p.id = t.seller_id
INNER JOIN items i ON i.id = t.item_id
WHERE t.status != 'cancelado';

CREATE INDEX idx_user_purchases_user ON user_purchases(user_id);
CREATE INDEX idx_user_purchases_status ON user_purchases(status);


-- 6️⃣ TRIGGER: Atualizar Views
-- ========================================

CREATE OR REPLACE FUNCTION refresh_financial_views()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_receivables;
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_purchases;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_refresh_views_on_tracking ON transactions;

CREATE TRIGGER trigger_refresh_views_on_tracking
AFTER UPDATE OF tracking_code, shipped_at, delivered_at, status ON transactions
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_financial_views();


-- ========================================
-- ✅ VERIFICAÇÃO
-- ========================================

-- Verificar estrutura da tabela
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'transactions'
  AND column_name IN ('tracking_code', 'shipped_at', 'delivered_at')
ORDER BY ordinal_position;

-- Verificar funções
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name IN ('add_tracking_code', 'confirm_delivery')
  AND routine_schema = 'public';

-- Verificar políticas RLS
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'transactions'
  AND policyname LIKE '%tracking%';

-- ========================================
-- 📋 INSTRUÇÕES
-- ========================================
/*
DEPLOY:
1. Execute este SQL no Supabase SQL Editor
2. Verifique se todas as views foram recriadas
3. Teste as functions:

-- Teste: Adicionar tracking
SELECT add_tracking_code(1, 'BR123456789PT');

-- Teste: Confirmar recebimento
SELECT confirm_delivery(1);

STATUS DA TRANSAÇÃO:
- pendente → pago → enviado → concluido
             ↓
          cancelado

PRÓXIMOS PASSOS:
1. ✅ Criar timeline visual no frontend
2. ✅ Interface vendedor: input tracking_code
3. ✅ Interface comprador: botão confirmar recebimento
4. ✅ Integrar ReviewModal após confirmação
*/

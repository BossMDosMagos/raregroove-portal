-- =====================================================================
-- FIX: Corrigir tipo de parâmetro em add_tracking_code() e confirm_delivery()
-- =====================================================================
-- Erro: "invalid input syntax for type bigint: 'b357cfb8-98ad-4715-bb86-babf48850163'"
-- Causa: Functions esperam BIGINT, mas recebem UUID (transaction_id é UUID)
-- Solução: Alterar ambas as functions para aceitar UUID em vez de BIGINT

-- 1️⃣ Dropar versão antiga
DROP FUNCTION IF EXISTS add_tracking_code(BIGINT, TEXT);
DROP FUNCTION IF EXISTS confirm_delivery(BIGINT);

-- 2️⃣ Recriar add_tracking_code() com UUID
CREATE OR REPLACE FUNCTION add_tracking_code(
  p_transaction_id UUID,
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

-- 3️⃣ Recriar confirm_delivery() com UUID

CREATE OR REPLACE FUNCTION confirm_delivery(
  p_transaction_id UUID
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
      'buyer_id', v_transaction.buyer_id,
      'amount', v_transaction.amount
    )
  );
  
  -- Resultado sucesso
  v_result := json_build_object(
    'success', true,
    'message', 'Recebimento confirmado com sucesso!',
    'transaction_id', p_transaction_id,
    'delivered_at', NOW(),
    'seller_name', v_seller_name
  );

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'message', 'Erro ao confirmar entrega: ' || SQLERRM
  );
END;
$$;

-- ✅ Testar função
-- SELECT confirm_delivery('b357cfb8-98ad-4715-bb86-babf48850163');

SELECT '✅ FIX aplicado com sucesso! confirm_delivery() agora aceita UUID.' AS status;

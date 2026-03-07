-- =====================================================================
-- FIX: Corrigir tipo de parâmetro em add_tracking_code() e confirm_delivery()
-- =====================================================================
-- Erro: "invalid input syntax for type bigint"
-- Causa: Functions esperam BIGINT, mas recebem UUID
-- Solucao: Alterar ambas as functions para aceitar UUID

-- 1. Dropar versoes antigas
DROP FUNCTION IF EXISTS add_tracking_code(BIGINT, TEXT);
DROP FUNCTION IF EXISTS confirm_delivery(BIGINT);

-- 2. Recriar add_tracking_code com UUID
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
  SELECT * INTO v_transaction
  FROM transactions
  WHERE id = p_transaction_id 
    AND seller_id = auth.uid()
    AND status = 'pago';
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Transacao nao encontrada ou nao pode ser enviada'
    );
  END IF;
  
  IF p_tracking_code IS NULL OR TRIM(p_tracking_code) = '' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Codigo de rastreio invalido'
    );
  END IF;
  
  UPDATE transactions
  SET 
    tracking_code = TRIM(UPPER(p_tracking_code)),
    shipped_at = NOW(),
    status = 'enviado'
  WHERE id = p_transaction_id;
  
  SELECT full_name INTO v_buyer_name
  FROM profiles
  WHERE id = v_transaction.buyer_id;
  
  INSERT INTO notifications (user_id, type, title, message, related_id)
  VALUES (
    v_transaction.buyer_id,
    'transaction',
    'Pedido Enviado!',
    'Seu pedido foi enviado. Codigo de rastreio: ' || TRIM(UPPER(p_tracking_code)),
    p_transaction_id
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Codigo de rastreio adicionado com sucesso',
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

-- 3. Recriar confirm_delivery com UUID
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
  SELECT * INTO v_transaction
  FROM transactions
  WHERE id = p_transaction_id 
    AND buyer_id = auth.uid()
    AND status = 'enviado';
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Transacao nao encontrada ou nao pode ser confirmada'
    );
  END IF;
  
  UPDATE transactions
  SET 
    delivered_at = NOW(),
    status = 'concluido'
  WHERE id = p_transaction_id;
  
  SELECT full_name INTO v_seller_name
  FROM profiles
  WHERE id = v_transaction.seller_id;
  
  -- Inserir notificação sem campos "link" e "data" (não existem na tabela)
  INSERT INTO notifications (user_id, type, title, message, related_id)
  VALUES (
    v_transaction.seller_id,
    'transaction',
    'Venda Concluida!',
    'O comprador confirmou o recebimento. Saldo liberado!',
    p_transaction_id
  );
  
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

SELECT 'FIX aplicado com sucesso! Ambas as functions agora aceitam UUID.' AS status;

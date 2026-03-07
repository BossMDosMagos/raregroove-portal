-- =====================================================================
-- FIX: Corrigir confirm_delivery() - Remover colunas inexistentes
-- =====================================================================
-- Erro: column "link" of relation "notifications" does not exist
-- Solução: Remover campos "link" e "data" que não existem na tabela

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
  
  -- CORREÇÃO: Remover campos "link" e "data" que não existem
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

SELECT '✅ FIX aplicado! confirm_delivery() corrigida sem campos inexistentes.' AS status;

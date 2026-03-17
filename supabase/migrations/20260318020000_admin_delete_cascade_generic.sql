-- Função robusta para excluir qualquer registro lidando com FK
CREATE OR REPLACE FUNCTION admin_delete_with_cascade(p_table TEXT, p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  v_related_count INT;
  v_error_msg TEXT;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas admin pode excluir';
  END IF;

  -- Para items, primeiro verificar e limpar dependências
  IF p_table = 'items' THEN
    -- Verificar transactions vinculadas
    GET DIAGNOSTICS v_related_count = ROW_COUNT;
    DELETE FROM transactions WHERE item_id = p_id;
    -- Verificar shipping vinculado
    DELETE FROM shipping WHERE item_id = p_id;
    -- Verificar wishlist
    DELETE FROM wishlist WHERE item_id = p_id;
    -- Por último excluir o item
    DELETE FROM items WHERE id = p_id;
  
  -- Para transactions
  ELSIF p_table = 'transactions' THEN
    -- Shipping primeiro
    DELETE FROM shipping WHERE transaction_id = p_id;
    -- Disputes
    DELETE FROM disputes WHERE transaction_id = p_id;
    -- SLA events
    DELETE FROM escrow_sla_events WHERE transaction_id = p_id;
    -- Transaction
    DELETE FROM transactions WHERE id = p_id;
  
  -- Para shipping - atualizar transactions primeiro
  ELSIF p_table = 'shipping' THEN
    UPDATE transactions SET shipping_id = NULL WHERE shipping_id = p_id;
    DELETE FROM shipping WHERE id = p_id;
  
  -- Para disputas - excluir filhos primeiro
  ELSIF p_table = 'disputes' THEN
    DELETE FROM dispute_messages WHERE dispute_id = p_id;
    DELETE FROM dispute_evidence WHERE dispute_id = p_id;
    DELETE FROM dispute_refund_tasks WHERE dispute_id = p_id;
    DELETE FROM disputes WHERE id = p_id;
  
  -- Demais tabelas - delete direto
  ELSE
    EXECUTE format('DELETE FROM %I WHERE id = $1', p_table) USING p_id;
  END IF;

  result := jsonb_build_object('success', true, 'message', p_table || ' excluído');
  RETURN result;

EXCEPTION WHEN OTHERS THEN
  result := jsonb_build_object('success', false, 'error', SQLERRM);
  RETURN result;
END;
$$;
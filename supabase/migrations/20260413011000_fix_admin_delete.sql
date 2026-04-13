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
  v_is_admin BOOLEAN := false;
BEGIN
  -- Verificar se é admin ou service role
  IF auth.uid() IS NOT NULL THEN
    SELECT is_admin INTO v_is_admin FROM profiles WHERE id = auth.uid();
  END IF;
  
  -- Service role bypass (via current_setting)
  IF current_setting('app.settings.service_role', true) = 'true' THEN
    v_is_admin := true;
  END IF;

  IF NOT v_is_admin AND current_setting('request.headers.service_role', true) != 'true' THEN
    RAISE EXCEPTION 'Apenas admin pode excluir';
  END IF;

  -- Para items, primeiro verificar e limpar dependências
  IF p_table = 'items' THEN
    DELETE FROM transactions WHERE item_id = p_id;
    DELETE FROM shipping WHERE item_id = p_id;
    DELETE FROM wishlist WHERE item_id = p_id;
    DELETE FROM items WHERE id = p_id;
  
  -- Para transactions
  ELSIF p_table = 'transactions' THEN
    DELETE FROM shipping WHERE transaction_id = p_id;
    DELETE FROM disputes WHERE transaction_id = p_id;
    DELETE FROM escrow_sla_events WHERE transaction_id = p_id;
    DELETE FROM transactions WHERE id = p_id;
  
  -- Para shipping
  ELSIF p_table = 'shipping' THEN
    UPDATE transactions SET shipping_id = NULL WHERE shipping_id = p_id;
    DELETE FROM shipping WHERE id = p_id;
  
  -- Para disputas
  ELSIF p_table = 'disputes' THEN
    DELETE FROM dispute_messages WHERE dispute_id = p_id;
    DELETE FROM dispute_evidence WHERE dispute_id = p_id;
    DELETE FROM dispute_refund_tasks WHERE dispute_id = p_id;
    DELETE FROM disputes WHERE id = p_id;
  
  -- Demais tabelas
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
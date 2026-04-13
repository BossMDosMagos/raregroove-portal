-- Função robusta para excluir qualquer registro lidando com FK
CREATE OR REPLACE FUNCTION admin_delete_with_cascade(p_table TEXT, p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  v_is_admin BOOLEAN := false;
  v_exists BOOLEAN;
BEGIN
  -- Verificar se é admin ou service role
  IF auth.uid() IS NOT NULL THEN
    SELECT is_admin INTO v_is_admin FROM profiles WHERE id = auth.uid();
  END IF;
  
  IF current_setting('app.settings.service_role', true) = 'true' THEN
    v_is_admin := true;
  END IF;

  IF NOT v_is_admin AND current_setting('request.headers.service_role', true) != 'true' THEN
    RAISE EXCEPTION 'Apenas admin pode excluir';
  END IF;

  -- Verificar se registro existe
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I WHERE id = $1)', p_table) USING p_id INTO v_exists;
  IF NOT v_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registro não encontrado');
  END IF;

  -- Para items - usar ONLY para ignorar herança
  IF p_table = 'items' THEN
    DELETE FROM ONLY items WHERE id = p_id;
  
  -- Para transactions
  ELSIF p_table = 'transactions' THEN
    DELETE FROM ONLY transactions WHERE id = p_id;
  
  -- Para shipping
  ELSIF p_table = 'shipping' THEN
    UPDATE ONLY transactions SET shipping_id = NULL WHERE shipping_id = p_id;
    DELETE FROM ONLY shipping WHERE id = p_id;
  
  -- Para disputes
  ELSIF p_table = 'disputes' THEN
    DELETE FROM ONLY disputes WHERE id = p_id;
  
  -- Demais tabelas - delete direto
  ELSE
    EXECUTE format('DELETE FROM ONLY %I WHERE id = $1', p_table) USING p_id;
  END IF;

  result := jsonb_build_object('success', true, 'message', p_table || ' excluído');
  RETURN result;

EXCEPTION WHEN OTHERS THEN
  result := jsonb_build_object('success', false, 'error', SQLERRM);
  RETURN result;
END;
$$;
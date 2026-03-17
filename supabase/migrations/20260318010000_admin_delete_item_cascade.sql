-- Função para excluir item com todas as dependências
CREATE OR REPLACE FUNCTION admin_delete_item_with_cascade(p_item_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Verificar se é admin
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas admin pode excluir';
  END IF;

  -- Excluir shipping relacionados
  DELETE FROM shipping WHERE item_id = p_item_id;

  -- Excluir wishlist relacionados
  DELETE FROM wishlist WHERE item_id = p_item_id;

  -- Excluir o item
  DELETE FROM items WHERE id = p_item_id;

  result := jsonb_build_object(
    'success', true,
    'message', 'Item e dependências excluídos'
  );

  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;
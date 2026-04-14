-- Recriar funcao admin_delete_with_cascade simplificada
CREATE OR REPLACE FUNCTION admin_delete_with_cascade(p_table TEXT, p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE format('DELETE FROM %I WHERE id = $1', p_table) USING p_id;
  RETURN jsonb_build_object('success', true, 'message', p_table || ' excluído');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
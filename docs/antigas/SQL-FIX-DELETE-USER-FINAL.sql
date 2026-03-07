-- ============================================================================
-- CORRIGIR: Renomear parâmetro para evitar ambiguidade
-- ============================================================================

-- 1. Dropar função antiga
DROP FUNCTION IF EXISTS delete_user_completely(uuid);

-- 2. Criar função com parâmetro renomeado (target_user_id)
CREATE OR REPLACE FUNCTION delete_user_completely(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  -- Verificar se quem está chamando é admin
  IF NOT (SELECT is_admin FROM profiles WHERE id = auth.uid()) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Apenas administradores podem excluir usuários'
    );
  END IF;

  -- 1. Deletar reviews (onde o usuário é reviewer ou reviewed)
  DELETE FROM reviews WHERE reviewer_id = target_user_id OR reviewed_id = target_user_id;
  
  -- 2. Deletar wishlist do usuário
  DELETE FROM wishlist WHERE user_id = target_user_id;
  
  -- 3. Deletar notificações do usuário
  DELETE FROM notifications WHERE user_id = target_user_id;
  
  -- 4. Deletar transações (onde o usuário é comprador ou vendedor)
  DELETE FROM transactions WHERE buyer_id = target_user_id OR seller_id = target_user_id;
  
  -- 5. Deletar mensagens enviadas OU recebidas pelo usuário
  DELETE FROM messages WHERE sender_id = target_user_id OR receiver_id = target_user_id;
  
  -- 6. Deletar itens do usuário
  DELETE FROM items WHERE seller_id = target_user_id;
  
  -- 7. Deletar da tabela profiles
  DELETE FROM profiles WHERE id = target_user_id;
  
  -- 8. Deletar do auth.users (schema auth)
  DELETE FROM auth.users WHERE id = target_user_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Usuário e todos os dados relacionados foram excluídos'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', SQLERRM
    );
END;
$$;

-- 3. Garantir permissões
GRANT EXECUTE ON FUNCTION delete_user_completely TO authenticated;

-- ============================================================================
-- TESTE
-- ============================================================================

-- Verificar se a função foi criada
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'delete_user_completely';

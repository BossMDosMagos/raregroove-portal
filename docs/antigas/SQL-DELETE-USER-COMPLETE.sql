-- ============================================================================
-- FUNÇÃO: Deletar usuário completamente (auth.users + profiles + todos os dados)
-- Para ser executada por ADMINISTRADORES via AdminUsers.jsx
-- ============================================================================

-- 1. Criar função que deleta o usuário e todas as dependências
CREATE OR REPLACE FUNCTION delete_user_completely(user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Permite executar com privilégios elevados
SET search_path = public
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
  DELETE FROM reviews WHERE reviewer_id = user_id OR reviewed_id = user_id;
  
  -- 2. Deletar wishlist do usuário
  DELETE FROM wishlist WHERE user_id = user_id;
  
  -- 3. Deletar notificações do usuário
  DELETE FROM notifications WHERE user_id = user_id;
  
  -- 4. Deletar transações (onde o usuário é comprador ou vendedor)
  DELETE FROM transactions WHERE buyer_id = user_id OR seller_id = user_id;
  
  -- 5. Deletar mensagens enviadas ou recebidas pelo usuário
  DELETE FROM messages WHERE sender_id = user_id OR receiver_id = user_id;
  
  -- 6. Deletar itens do usuário
  DELETE FROM items WHERE seller_id = user_id;
  
  -- 7. Deletar da tabela profiles
  DELETE FROM profiles WHERE id = user_id;
  
  -- 8. Deletar do auth.users (schema auth)
  DELETE FROM auth.users WHERE id = user_id;
  
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

-- 2. Dar permissão para a função ser executada
GRANT EXECUTE ON FUNCTION delete_user_completely(uuid) TO authenticated;

-- ============================================================================
-- TESTE (NÃO EXECUTE EM PRODUÇÃO SEM VERIFICAR)
-- ============================================================================
-- SELECT delete_user_completely('uuid-do-usuario-teste');

-- ============================================================================
-- DELETAR USUÁRIOS ÓRFÃOS COM TODAS AS DEPENDÊNCIAS
-- Este SQL deleta o usuário E todos os dados relacionados (mensagens, itens, etc.)
-- ============================================================================

-- IMPORTANTE: Este script deleta PERMANENTEMENTE todos os dados do usuário!
-- Execute apenas se tiver certeza que quer apagar tudo.

-- ============================================================================
-- PASSO 1: Ver o que será deletado (EXECUTE PRIMEIRO PARA VERIFICAR)
-- ============================================================================

-- Usuários órfãos e seus dados relacionados
SELECT 
  u.id,
  u.email,
  COUNT(DISTINCT m.id) as "Total de Mensagens",
  COUNT(DISTINCT i.id) as "Total de Itens",
  COUNT(DISTINCT t.id) as "Total de Transações",
  COUNT(DISTINCT w.id) as "Total de Wishlist",
  COUNT(DISTINCT r.id) as "Total de Reviews"
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
LEFT JOIN messages m ON u.id = m.sender_id OR u.id = m.receiver_id
LEFT JOIN items i ON u.id = i.seller_id
LEFT JOIN transactions t ON u.id = t.buyer_id OR u.id = t.seller_id
LEFT JOIN wishlist w ON u.id = w.user_id
LEFT JOIN reviews r ON u.id = r.reviewer_id OR u.id = r.reviewed_id
WHERE p.id IS NULL
GROUP BY u.id, u.email;

-- ============================================================================
-- PASSO 2: Deletar tudo (APENAS APÓS VERIFICAR O PASSO 1)
-- ============================================================================

-- 2.1: Encontrar IDs dos usuários órfãos
DO $$ 
DECLARE 
  orphan_user RECORD;
BEGIN
  FOR orphan_user IN 
    SELECT u.id 
    FROM auth.users u
    LEFT JOIN profiles p ON u.id = p.id
    WHERE p.id IS NULL
  LOOP
    -- Deletar reviews onde o usuário é reviewer ou reviewed
    DELETE FROM reviews WHERE reviewer_id = orphan_user.id OR reviewed_id = orphan_user.id;
    
    -- Deletar wishlist do usuário
    DELETE FROM wishlist WHERE user_id = orphan_user.id;
    
    -- Deletar notificações do usuário
    DELETE FROM notifications WHERE user_id = orphan_user.id;
    
    -- Deletar transações onde o usuário é comprador ou vendedor
    DELETE FROM transactions WHERE buyer_id = orphan_user.id OR seller_id = orphan_user.id;
    
    -- Deletar mensagens enviadas ou recebidas pelo usuário
    DELETE FROM messages WHERE sender_id = orphan_user.id OR receiver_id = orphan_user.id;
    
    -- Deletar itens do usuário
    DELETE FROM items WHERE seller_id = orphan_user.id;
    
    -- Finalmente, deletar o usuário de auth.users
    DELETE FROM auth.users WHERE id = orphan_user.id;
    
    RAISE NOTICE 'Usuário % deletado com sucesso', orphan_user.id;
  END LOOP;
END $$;

-- ============================================================================
-- PASSO 3: Verificar que foi deletado
-- ============================================================================

-- Não deve retornar nada (0 rows)
SELECT u.id, u.email
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- ============================================================================
-- RESULTADO ESPERADO:
-- ============================================================================
-- ✅ Todos os usuários órfãos foram deletados
-- ✅ Todos os dados relacionados foram deletados
-- ✅ Sistema limpo para novos cadastros
-- ============================================================================

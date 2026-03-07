-- ============================================================================
-- PASSO 1: VERIFICAR USUÁRIOS ÓRFÃOS E SEUS DADOS
-- Execute este SQL PRIMEIRO para ver o que será deletado
-- ============================================================================

SELECT 
  u.id,
  u.email,
  u.created_at as "Criado em",
  COUNT(DISTINCT m.id) as "Mensagens",
  COUNT(DISTINCT i.id) as "Itens",
  COUNT(DISTINCT t.id) as "Transações",
  COUNT(DISTINCT w.id) as "Wishlist",
  COUNT(DISTINCT r.id) as "Reviews"
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
LEFT JOIN messages m ON u.id = m.sender_id OR u.id = m.receiver_id
LEFT JOIN items i ON u.id = i.seller_id
LEFT JOIN transactions t ON u.id = t.buyer_id OR u.id = t.seller_id
LEFT JOIN wishlist w ON u.id = w.user_id
LEFT JOIN reviews r ON u.id = r.reviewer_id OR u.id = r.reviewed_id
WHERE p.id IS NULL
GROUP BY u.id, u.email, u.created_at
ORDER BY u.created_at DESC;

-- ============================================================================
-- PASSO 2: DELETAR USUÁRIOS ÓRFÃOS E TODAS AS DEPENDÊNCIAS
-- ⚠️ ATENÇÃO: Isso deleta PERMANENTEMENTE todos os dados relacionados!
-- Execute apenas após analisar o PASSO 1
-- ============================================================================

DO $$ 
DECLARE 
  orphan_user RECORD;
  deleted_count INTEGER := 0;
BEGIN
  FOR orphan_user IN 
    SELECT u.id, u.email
    FROM auth.users u
    LEFT JOIN profiles p ON u.id = p.id
    WHERE p.id IS NULL
  LOOP
    -- Deletar reviews (onde o usuário é reviewer ou reviewed)
    DELETE FROM reviews WHERE reviewer_id = orphan_user.id OR reviewed_id = orphan_user.id;
    
    -- Deletar wishlist do usuário
    DELETE FROM wishlist WHERE user_id = orphan_user.id;
    
    -- Deletar notificações do usuário
    DELETE FROM notifications WHERE user_id = orphan_user.id;
    
    -- Deletar transações (onde o usuário é comprador ou vendedor)
    DELETE FROM transactions WHERE buyer_id = orphan_user.id OR seller_id = orphan_user.id;
    
    -- Deletar mensagens enviadas ou recebidas pelo usuário
    DELETE FROM messages WHERE sender_id = orphan_user.id OR receiver_id = orphan_user.id;
    
    -- Deletar itens do usuário
    DELETE FROM items WHERE seller_id = orphan_user.id;
    
    -- Deletar do auth.users
    DELETE FROM auth.users WHERE id = orphan_user.id;
    
    deleted_count := deleted_count + 1;
    RAISE NOTICE 'Usuário % (%) deletado com sucesso', orphan_user.email, orphan_user.id;
  END LOOP;
  
  RAISE NOTICE '✅ Total de usuários órfãos deletados: %', deleted_count;
END $$;

-- ============================================================================
-- PASSO 3: CONFIRMAR QUE NÃO HÁ MAIS USUÁRIOS ÓRFÃOS
-- Deve retornar 0 rows (vazio)
-- ============================================================================

SELECT u.id, u.email, 'AINDA ÓRFÃO' as status
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- Se retornar vazio: ✅ Sucesso! Agora pode cadastrar normalmente
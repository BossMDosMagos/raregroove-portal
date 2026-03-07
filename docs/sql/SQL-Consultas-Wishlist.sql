-- ========================================
-- CONSULTAS ÚTEIS - SISTEMA WISHLIST E NOTIFICAÇÕES
-- ========================================

-- 1. Ver todos os desejos de um usuário
SELECT 
  w.*,
  p.full_name,
  p.email
FROM wishlist w
JOIN profiles p ON p.id = w.user_id
WHERE w.user_id = 'USER_UUID_AQUI'
ORDER BY w.created_at DESC;

-- 2. Ver desejos ativos (que estão fazendo match)
SELECT 
  w.*,
  p.full_name
FROM wishlist w
JOIN profiles p ON p.id = w.user_id
WHERE w.active = true
ORDER BY w.created_at DESC;

-- 3. Contar desejos por usuário
SELECT 
  p.full_name,
  COUNT(*) as total_desejos,
  COUNT(*) FILTER (WHERE w.active = true) as desejos_ativos
FROM profiles p
LEFT JOIN wishlist w ON w.user_id = p.id
GROUP BY p.id, p.full_name
ORDER BY total_desejos DESC;

-- 4. Ver todas as notificações de um usuário
SELECT 
  n.*,
  i.title as item_title,
  i.price as item_price
FROM notifications n
LEFT JOIN items i ON i.id = n.item_id
WHERE n.user_id = 'USER_UUID_AQUI'
ORDER BY n.created_at DESC;

-- 5. Ver apenas notificações não lidas
SELECT 
  n.*,
  i.title as item_title
FROM notifications n
LEFT JOIN items i ON i.id = n.item_id
WHERE n.user_id = 'USER_UUID_AQUI'
AND n.is_read = false
ORDER BY n.created_at DESC;

-- 6. Contar notificações por tipo
SELECT 
  type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_read = false) as nao_lidas
FROM notifications
WHERE user_id = 'USER_UUID_AQUI'
GROUP BY type
ORDER BY total DESC;

-- 7. Ver matches de wishlist (notificações de item encontrado)
SELECT 
  n.created_at,
  n.title,
  n.message,
  i.title as item_titulo,
  i.price as item_preco,
  i.image_url,
  p.full_name as vendedor
FROM notifications n
JOIN items i ON i.id = n.item_id
JOIN profiles p ON p.id = i.seller_id
WHERE n.type = 'wishlist_match'
AND n.user_id = 'USER_UUID_AQUI'
ORDER BY n.created_at DESC;

-- 8. Simular um match manualmente (para testes)
-- Primeiro, encontre um item e um desejo compatíveis
SELECT 
  i.id as item_id,
  i.title as item_title,
  i.price,
  w.id as wish_id,
  w.item_name as wish_name,
  w.user_id
FROM items i
CROSS JOIN wishlist w
WHERE w.active = true
AND (
  LOWER(i.title) LIKE '%' || LOWER(w.item_name) || '%'
  OR LOWER(w.item_name) LIKE '%' || LOWER(i.title) || '%'
)
LIMIT 5;

-- 9. Criar notificação de match manualmente
INSERT INTO notifications (user_id, type, title, message, item_id)
VALUES (
  'USER_UUID_AQUI',
  'wishlist_match',
  '🔥 ITEM ENCONTRADO!',
  'O item "Nome do Item" que você procurava acaba de entrar no acervo! Preço: R$ 99.90',
  'ITEM_UUID_AQUI'
);

-- 10. Testar função de match para um item específico
SELECT check_wishlist_match(
  'Dark Side of the Moon',  -- título do item
  'Pink Floyd',              -- artista
  'Novo',                    -- categoria
  150.00,                    -- preço
  'ITEM_UUID_AQUI'          -- ID do item
);

-- 11. Ver histórico de matches por período
SELECT 
  DATE(n.created_at) as data,
  COUNT(*) as total_matches,
  COUNT(DISTINCT n.user_id) as usuarios_notificados
FROM notifications n
WHERE n.type = 'wishlist_match'
AND n.created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(n.created_at)
ORDER BY data DESC;

-- 12. Desejos mais populares (palavras-chave mais buscadas)
SELECT 
  LOWER(item_name) as desejo,
  COUNT(*) as total_usuarios,
  AVG(max_price) as preco_medio_desejado
FROM wishlist
WHERE active = true
GROUP BY LOWER(item_name)
HAVING COUNT(*) > 1
ORDER BY total_usuarios DESC
LIMIT 20;

-- 13. Ver itens que fariam match com desejos ativos
SELECT 
  i.id,
  i.title,
  i.artist,
  i.price,
  COUNT(DISTINCT w.user_id) as potenciais_compradores
FROM items i
JOIN wishlist w ON w.active = true
  AND (
    LOWER(i.title) LIKE '%' || LOWER(w.item_name) || '%'
    OR LOWER(w.item_name) LIKE '%' || LOWER(i.title) || '%'
    OR (w.artist IS NOT NULL AND LOWER(i.artist) LIKE '%' || LOWER(w.artist) || '%')
  )
WHERE i.status = 'disponivel'
GROUP BY i.id, i.title, i.artist, i.price
ORDER BY potenciais_compradores DESC;

-- 14. Limpar notificações antigas (lidas há mais de 30 dias)
SELECT cleanup_old_notifications(30);

-- 15. Marcar todas as notificações como lidas (para um usuário)
SELECT mark_all_notifications_read('USER_UUID_AQUI');

-- 16. Estatísticas gerais do sistema
SELECT 
  (SELECT COUNT(*) FROM wishlist WHERE active = true) as desejos_ativos,
  (SELECT COUNT(DISTINCT user_id) FROM wishlist WHERE active = true) as usuarios_com_desejos,
  (SELECT COUNT(*) FROM notifications WHERE type = 'wishlist_match') as total_matches,
  (SELECT COUNT(*) FROM notifications WHERE type = 'wishlist_match' AND created_at >= NOW() - INTERVAL '7 days') as matches_ultimos_7_dias;

-- 17. Taxa de sucesso (matches que viraram conversas)
SELECT 
  COUNT(DISTINCT n.id) as total_matches,
  COUNT(DISTINCT m.id) as conversas_iniciadas,
  ROUND(
    (COUNT(DISTINCT m.id)::numeric / NULLIF(COUNT(DISTINCT n.id), 0)) * 100,
    2
  ) as taxa_conversao_pct
FROM notifications n
LEFT JOIN messages m ON m.receiver_id = n.user_id 
  AND m.created_at > n.created_at
  AND m.created_at < n.created_at + INTERVAL '7 days'
WHERE n.type = 'wishlist_match'
AND n.created_at >= NOW() - INTERVAL '30 days';

-- 18. Desejos sem match há muito tempo (oportunidade de anunciar)
SELECT 
  w.item_name,
  w.artist,
  w.max_price,
  w.created_at,
  AGE(NOW(), w.created_at) as tempo_esperando,
  COUNT(*) as usuarios_procurando
FROM wishlist w
LEFT JOIN notifications n ON n.user_id = w.user_id AND n.type = 'wishlist_match'
WHERE w.active = true
AND n.id IS NULL  -- Nunca recebeu match
GROUP BY w.item_name, w.artist, w.max_price, w.created_at
HAVING COUNT(*) > 0
ORDER BY COUNT(*) DESC, w.created_at ASC
LIMIT 20;

-- 19. Performance do trigger (verificar se está funcionando)
-- Inserir um item de teste e verificar se criou notificações
BEGIN;
  -- Salvar contagem atual
  CREATE TEMP TABLE IF NOT EXISTS notif_count AS 
    SELECT COUNT(*) as antes FROM notifications;
  
  -- Inserir item de teste (ajuste seller_id)
  INSERT INTO items (seller_id, title, artist, price, condition, allow_sale)
  VALUES (
    (SELECT id FROM auth.users LIMIT 1),
    'Dark Side of the Moon',
    'Pink Floyd',
    150.00,
    'Novo',
    true
  );
  
  -- Verificar se notificações foram criadas
  SELECT 
    (SELECT COUNT(*) FROM notifications) - (SELECT antes FROM notif_count) as notificacoes_criadas;
    
ROLLBACK; -- Desfazer teste

-- 20. Auditoria: Listar ações recentes no sistema
SELECT 
  'wishlist' as tabela,
  'INSERT' as acao,
  w.created_at,
  p.full_name as usuario,
  w.item_name as detalhe
FROM wishlist w
JOIN profiles p ON p.id = w.user_id
WHERE w.created_at >= NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
  'notifications' as tabela,
  'INSERT' as acao,
  n.created_at,
  p.full_name as usuario,
  n.title as detalhe
FROM notifications n
JOIN profiles p ON p.id = n.user_id
WHERE n.created_at >= NOW() - INTERVAL '24 hours'

ORDER BY created_at DESC
LIMIT 50;

-- ========================================
-- CONSULTAS ÚTEIS - SISTEMA DE TRANSAÇÕES
-- ========================================
-- Use estas queries para monitorar e gerenciar transações

-- 1️⃣ VER TODAS AS TRANSAÇÕES COM DETALHES
SELECT 
  t.id as "ID Transação",
  i.title as "Item",
  i.artist as "Artista",
  pb.full_name as "Comprador",
  ps.full_name as "Vendedor",
  t.status as "Status",
  CONCAT('R$ ', t.price) as "Valor",
  t.created_at as "Criada em",
  t.updated_at as "Atualizada em"
FROM transactions t
JOIN items i ON t.item_id = i.id
JOIN profiles pb ON t.buyer_id = pb.id
JOIN profiles ps ON t.seller_id = ps.id
ORDER BY t.created_at DESC;

-- 2️⃣ TRANSAÇÕES POR STATUS
SELECT 
  status,
  COUNT(*) as quantidade,
  CONCAT('R$ ', SUM(price)::text) as valor_total
FROM transactions
GROUP BY status
ORDER BY quantidade DESC;

-- 3️⃣ ITENS POR STATUS
SELECT 
  status,
  COUNT(*) as quantidade
FROM items
GROUP BY status
ORDER BY quantidade DESC;

-- 4️⃣ VENDEDORES MAIS ATIVOS (com transações)
SELECT 
  p.full_name as "Vendedor",
  COUNT(t.id) as "Total Vendas",
  COUNT(CASE WHEN t.status = 'concluido' THEN 1 END) as "Concluídas",
  COUNT(CASE WHEN t.status = 'pendente' THEN 1 END) as "Pendentes",
  CONCAT('R$ ', SUM(t.price)::text) as "Valor Total"
FROM transactions t
JOIN profiles p ON t.seller_id = p.id
GROUP BY p.id, p.full_name
ORDER BY COUNT(t.id) DESC;

-- 5️⃣ COMPRADORES MAIS ATIVOS
SELECT 
  p.full_name as "Comprador",
  COUNT(t.id) as "Total Compras",
  COUNT(CASE WHEN t.status = 'concluido' THEN 1 END) as "Concluídas",
  CONCAT('R$ ', SUM(t.price)::text) as "Valor Total Gasto"
FROM transactions t
JOIN profiles p ON t.buyer_id = p.id
GROUP BY p.id, p.full_name
ORDER BY COUNT(t.id) DESC;

-- 6️⃣ TRANSAÇÕES ATIVAS (em andamento)
SELECT 
  t.id,
  i.title as "Item",
  pb.full_name as "Comprador",
  ps.full_name as "Vendedor",
  t.status,
  CONCAT('R$ ', t.price) as "Valor",
  AGE(NOW(), t.created_at) as "Tempo decorrido"
FROM transactions t
JOIN items i ON t.item_id = i.id
JOIN profiles pb ON t.buyer_id = pb.id
JOIN profiles ps ON t.seller_id = ps.id
WHERE t.status IN ('pendente', 'pago', 'enviado')
ORDER BY t.created_at ASC;

-- 7️⃣ ITENS RESERVADOS (em negociação)
SELECT 
  i.id,
  i.title as "Item",
  i.artist as "Artista",
  p.full_name as "Vendedor",
  CONCAT('R$ ', i.price) as "Preço",
  i.created_at as "Anunciado em"
FROM items i
JOIN profiles p ON i.seller_id = p.id
WHERE i.status = 'reservado'
ORDER BY i.created_at DESC;

-- 8️⃣ ITENS VENDIDOS (finalizados)
SELECT 
  i.id,
  i.title as "Item",
  i.artist as "Artista",
  p.full_name as "Ex-Vendedor",
  CONCAT('R$ ', i.price) as "Preço de Venda",
  i.created_at as "Vendido em"
FROM items i
JOIN profiles p ON i.seller_id = p.id
WHERE i.status = 'vendido'
ORDER BY i.created_at DESC;

-- 9️⃣ HISTÓRICO DE UM USUÁRIO ESPECÍFICO
-- Substitua 'USER_ID_AQUI' pelo ID do usuário
WITH user_id AS (
  SELECT 'USER_ID_AQUI'::uuid as id
)
SELECT 
  CASE 
    WHEN t.seller_id = (SELECT id FROM user_id) THEN 'VENDA'
    ELSE 'COMPRA'
  END as "Tipo",
  i.title as "Item",
  CASE 
    WHEN t.seller_id = (SELECT id FROM user_id) THEN pb.full_name
    ELSE ps.full_name
  END as "Outro Usuário",
  t.status as "Status",
  CONCAT('R$ ', t.price) as "Valor",
  t.created_at as "Data"
FROM transactions t
JOIN items i ON t.item_id = i.id
JOIN profiles pb ON t.buyer_id = pb.id
JOIN profiles ps ON t.seller_id = ps.id
WHERE t.buyer_id = (SELECT id FROM user_id) 
   OR t.seller_id = (SELECT id FROM user_id)
ORDER BY t.created_at DESC;

-- 🔟 ESTATÍSTICAS GERAIS DO SISTEMA
SELECT 
  (SELECT COUNT(*) FROM transactions) as "Total Transações",
  (SELECT COUNT(*) FROM transactions WHERE status = 'concluido') as "Transações Concluídas",
  (SELECT COUNT(*) FROM transactions WHERE status = 'pendente') as "Pendentes Pagamento",
  (SELECT COUNT(*) FROM items WHERE status = 'reservado') as "Itens Reservados",
  (SELECT COUNT(*) FROM items WHERE status = 'vendido') as "Itens Vendidos",
  (SELECT COUNT(*) FROM items WHERE status = 'disponivel') as "Itens Disponíveis",
  CONCAT('R$ ', (SELECT SUM(price) FROM transactions WHERE status = 'concluido')::text) as "Volume Total Vendido",
  CONCAT('R$ ', (SELECT AVG(price) FROM transactions WHERE status = 'concluido')::text) as "Ticket Médio";

-- ========================================
-- COMANDOS DE MANUTENÇÃO (USE COM CUIDADO)
-- ========================================

-- ⚠️ ATUALIZAR STATUS DE TRANSAÇÃO MANUALMENTE
-- UPDATE transactions 
-- SET status = 'pago' 
-- WHERE id = 'TRANSACTION_ID_AQUI';

-- ⚠️ CANCELAR TRANSAÇÃO E LIBERAR ITEM
-- UPDATE transactions SET status = 'cancelado' WHERE id = 'TRANSACTION_ID_AQUI';
-- UPDATE items SET status = 'disponivel' WHERE id = 'ITEM_ID_AQUI';

-- ⚠️ MARCAR ITEM COMO VENDIDO
-- UPDATE items SET status = 'vendido' WHERE id = 'ITEM_ID_AQUI';
-- UPDATE transactions SET status = 'concluido' WHERE item_id = 'ITEM_ID_AQUI';

-- ⚠️ RESETAR ITEM PARA DISPONÍVEL (caso erro)
-- UPDATE items SET status = 'disponivel' WHERE id = 'ITEM_ID_AQUI';

-- ⚠️ DELETAR TRANSAÇÃO (último recurso - perda de histórico)
-- DELETE FROM transactions WHERE id = 'TRANSACTION_ID_AQUI';

-- ========================================
-- DEBUGGING
-- ========================================

-- Ver políticas RLS ativas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'transactions';

-- Ver estrutura da tabela
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'transactions'
ORDER BY ordinal_position;

-- Ver índices criados
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'transactions';

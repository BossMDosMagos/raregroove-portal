-- ========================================
-- CONSULTAS ÚTEIS - SISTEMA DE REVIEWS
-- ========================================
-- Use estas queries para monitorar e gerenciar avaliações

-- 1️⃣ VER TODAS AS REVIEWS COM DETALHES COMPLETOS
SELECT 
  r.id as "ID Review",
  r.rating as "Nota",
  r.comment as "Comentário",
  r.created_at as "Data",
  pr.full_name as "Quem Avaliou",
  pr.email as "Email Avaliador",
  pd.full_name as "Quem Foi Avaliado",
  pd.email as "Email Avaliado",
  t.id as "Transaction ID",
  i.title as "Item da Transação"
FROM reviews r
JOIN profiles pr ON r.reviewer_id = pr.id
JOIN profiles pd ON r.reviewed_id = pd.id
JOIN transactions t ON r.transaction_id = t.id
JOIN items i ON t.item_id = i.id
ORDER BY r.created_at DESC;

-- 2️⃣ ESTATÍSTICAS POR USUÁRIO
SELECT 
  p.full_name as "Usuário",
  p.email,
  COUNT(r.id) as "Total Reviews Recebidas",
  ROUND(AVG(r.rating)::numeric, 2) as "Média",
  COUNT(r.id) FILTER (WHERE r.rating = 5) as "5 Estrelas",
  COUNT(r.id) FILTER (WHERE r.rating = 4) as "4 Estrelas",
  COUNT(r.id) FILTER (WHERE r.rating = 3) as "3 Estrelas",
  COUNT(r.id) FILTER (WHERE r.rating = 2) as "2 Estrelas",
  COUNT(r.id) FILTER (WHERE r.rating = 1) as "1 Estrela"
FROM profiles p
LEFT JOIN reviews r ON r.reviewed_id = p.id
GROUP BY p.id, p.full_name, p.email
HAVING COUNT(r.id) > 0
ORDER BY AVG(r.rating) DESC, COUNT(r.id) DESC;

-- 3️⃣ TOP 10 VENDEDORES (MELHORES AVALIADOS)
SELECT 
  p.full_name as "Vendedor",
  COUNT(t.id) as "Total Vendas",
  COUNT(r.id) as "Total Reviews",
  ROUND(AVG(r.rating)::numeric, 2) as "Média",
  CASE 
    WHEN COUNT(t.id) >= 10 AND AVG(r.rating) >= 4.8 THEN '⭐ ELITE'
    ELSE 'Regular'
  END as "Status"
FROM profiles p
JOIN transactions t ON t.seller_id = p.id
LEFT JOIN reviews r ON r.reviewed_id = p.id
WHERE t.status = 'concluido'
GROUP BY p.id, p.full_name
HAVING COUNT(r.id) > 0
ORDER BY AVG(r.rating) DESC, COUNT(t.id) DESC
LIMIT 10;

-- 4️⃣ VENDEDORES ELITE (10+ VENDAS, 4.8+ RATING)
SELECT 
  p.full_name as "Vendedor Elite",
  p.email,
  COUNT(t.id) FILTER (WHERE t.status = 'concluido') as "Vendas Concluídas",
  ROUND(AVG(r.rating)::numeric, 2) as "Média Rating",
  COUNT(r.id) as "Total Reviews",
  COUNT(r.id) FILTER (WHERE r.rating = 5) as "5 Estrelas"
FROM profiles p
JOIN transactions t ON t.seller_id = p.id
LEFT JOIN reviews r ON r.reviewed_id = p.id AND r.transaction_id IN (
  SELECT id FROM transactions WHERE seller_id = p.id AND status = 'concluido'
)
GROUP BY p.id, p.full_name, p.email
HAVING 
  COUNT(t.id) FILTER (WHERE t.status = 'concluido') >= 10
  AND AVG(r.rating) >= 4.8
ORDER BY AVG(r.rating) DESC;

-- 5️⃣ REVIEWS MAIS RECENTES (ÚLTIMAS 20)
SELECT 
  r.created_at as "Data",
  r.rating as "⭐",
  LEFT(r.comment, 50) || '...' as "Comentário (preview)",
  pr.full_name as "De",
  pd.full_name as "Para",
  i.title as "Item"
FROM reviews r
JOIN profiles pr ON r.reviewer_id = pr.id
JOIN profiles pd ON r.reviewed_id = pd.id
JOIN transactions t ON r.transaction_id = t.id
JOIN items i ON t.item_id = i.id
ORDER BY r.created_at DESC
LIMIT 20;

-- 6️⃣ REVIEWS POR RATING (DISTRIBUIÇÃO)
SELECT 
  r.rating as "Estrelas",
  COUNT(*) as "Quantidade",
  ROUND((COUNT(*)::numeric / (SELECT COUNT(*) FROM reviews) * 100), 2) || '%' as "Percentual"
FROM reviews r
GROUP BY r.rating
ORDER BY r.rating DESC;

-- 7️⃣ USUÁRIOS SEM REVIEWS (NUNCA FORAM AVALIADOS)
SELECT 
  p.full_name as "Usuário",
  p.email,
  COUNT(t.id) FILTER (WHERE t.seller_id = p.id AND t.status = 'concluido') as "Vendas Concluídas",
  COUNT(t.id) FILTER (WHERE t.buyer_id = p.id AND t.status = 'concluido') as "Compras Concluídas"
FROM profiles p
LEFT JOIN transactions t ON (t.seller_id = p.id OR t.buyer_id = p.id)
LEFT JOIN reviews r ON r.reviewed_id = p.id
WHERE r.id IS NULL
GROUP BY p.id, p.full_name, p.email
HAVING 
  COUNT(t.id) FILTER (WHERE t.seller_id = p.id AND t.status = 'concluido') > 0
  OR COUNT(t.id) FILTER (WHERE t.buyer_id = p.id AND t.status = 'concluido') > 0
ORDER BY "Vendas Concluídas" DESC;

-- 8️⃣ TRANSAÇÕES PENDENTES DE AVALIAÇÃO
-- Transações concluídas que ainda não receberam review do comprador ou vendedor
WITH completed_transactions AS (
  SELECT 
    t.id,
    t.created_at,
    t.buyer_id,
    t.seller_id,
    i.title as item_title,
    pb.full_name as buyer_name,
    ps.full_name as seller_name
  FROM transactions t
  JOIN items i ON t.item_id = i.id
  JOIN profiles pb ON t.buyer_id = pb.id
  JOIN profiles ps ON t.seller_id = ps.id
  WHERE t.status = 'concluido'
)
SELECT 
  ct.id as "Transaction ID",
  ct.item_title as "Item",
  ct.buyer_name as "Comprador",
  ct.seller_name as "Vendedor",
  ct.created_at as "Concluída em",
  CASE WHEN rb.id IS NULL THEN '❌ Falta' ELSE '✅ Feita' END as "Review do Comprador",
  CASE WHEN rs.id IS NULL THEN '❌ Falta' ELSE '✅ Feita' END as "Review do Vendedor"
FROM completed_transactions ct
LEFT JOIN reviews rb ON rb.transaction_id = ct.id AND rb.reviewer_id = ct.buyer_id
LEFT JOIN reviews rs ON rs.transaction_id = ct.id AND rs.reviewer_id = ct.seller_id
WHERE rb.id IS NULL OR rs.id IS NULL
ORDER BY ct.created_at DESC;

-- 9️⃣ RATING MÉDIO POR MÊS (TENDÊNCIA)
SELECT 
  TO_CHAR(r.created_at, 'YYYY-MM') as "Mês",
  COUNT(*) as "Total Reviews",
  ROUND(AVG(r.rating)::numeric, 2) as "Média do Mês"
FROM reviews r
GROUP BY TO_CHAR(r.created_at, 'YYYY-MM')
ORDER BY "Mês" DESC;

-- 🔟 COMENTÁRIOS MAIS LONGOS (TOP 10)
SELECT 
  r.created_at as "Data",
  r.rating as "⭐",
  LENGTH(r.comment) as "Caracteres",
  pr.full_name as "De",
  pd.full_name as "Para",
  r.comment as "Comentário Completo"
FROM reviews r
JOIN profiles pr ON r.reviewer_id = pr.id
JOIN profiles pd ON r.reviewed_id = pd.id
WHERE r.comment IS NOT NULL
ORDER BY LENGTH(r.comment) DESC
LIMIT 10;

-- ========================================
-- FUNÇÕES ÚTEIS
-- ========================================

-- 1️⃣1️⃣ VER RATING DE UM USUÁRIO ESPECÍFICO
-- Substitua '[USER_ID]' pelo ID do usuário
SELECT * FROM get_user_rating('[USER_ID]');

-- Exemplo com resultado formatado:
WITH stats AS (
  SELECT * FROM get_user_rating('[USER_ID]')
)
SELECT 
  'Média: ' || avg_rating || ' ⭐' as rating,
  'Total: ' || total_reviews || ' avaliações' as total,
  '5⭐: ' || rating_5_count as cinco,
  '4⭐: ' || rating_4_count as quatro,
  '3⭐: ' || rating_3_count as tres,
  '2⭐: ' || rating_2_count as dois,
  '1⭐: ' || rating_1_count as um
FROM stats;

-- 1️⃣2️⃣ VERIFICAR SE USUÁRIO É ELITE
-- Substitua '[USER_ID]' pelo ID do usuário
SELECT * FROM is_elite_seller('[USER_ID]');

-- Exemplo com resultado formatado:
WITH elite_check AS (
  SELECT * FROM is_elite_seller('[USER_ID]')
)
SELECT 
  CASE WHEN is_elite THEN '⭐ ELITE' ELSE 'Regular' END as status,
  'Média: ' || avg_rating || ' ⭐' as rating,
  'Vendas: ' || completed_sales as vendas
FROM elite_check;

-- 1️⃣3️⃣ ATUALIZAR STATS (VIEW MATERIALIZADA)
SELECT refresh_user_ratings_stats();

-- Verificar última atualização da view:
SELECT 
  schemaname,
  matviewname,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size,
  ispopulated as "Populated"
FROM pg_matviews
WHERE matviewname = 'user_ratings_stats';

-- ========================================
-- COMANDOS DE MANUTENÇÃO (USE COM CUIDADO)
-- ========================================

-- ⚠️ DELETAR REVIEW ESPECÍFICA
-- DELETE FROM reviews WHERE id = '[REVIEW_ID]';

-- ⚠️ DELETAR TODAS AS REVIEWS DE UM USUÁRIO
-- DELETE FROM reviews WHERE reviewed_id = '[USER_ID]';

-- ⚠️ ATUALIZAR RATING DE UMA REVIEW
-- UPDATE reviews 
-- SET rating = 5, comment = 'Atualizado'
-- WHERE id = '[REVIEW_ID]';

-- ⚠️ FORÇAR REBUILD DA VIEW MATERIALIZADA
-- DROP MATERIALIZED VIEW user_ratings_stats;
-- Depois execute novamente o SQL de criação

-- ========================================
-- ESTATÍSTICAS GERAIS DO SISTEMA
-- ========================================

SELECT 
  (SELECT COUNT(*) FROM reviews) as "Total Reviews",
  (SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews) as "Média Geral",
  (SELECT COUNT(DISTINCT reviewed_id) FROM reviews) as "Usuários Avaliados",
  (SELECT COUNT(DISTINCT reviewer_id) FROM reviews) as "Usuários Avaliadores",
  (SELECT COUNT(*) FROM reviews WHERE rating = 5) as "5 Estrelas",
  (SELECT COUNT(*) FROM reviews WHERE rating >= 4) as "4+ Estrelas",
  (SELECT COUNT(*) FROM user_ratings_stats WHERE is_elite = true) as "Vendedores Elite",
  (SELECT COUNT(*) FROM reviews WHERE comment IS NOT NULL) as "Com Comentário";

-- ========================================
-- DEBUGGING
-- ========================================

-- Ver estrutura da tabela reviews
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'reviews'
ORDER BY ordinal_position;

-- Ver políticas RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'reviews';

-- Ver índices
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'reviews';

-- Ver triggers
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'reviews';

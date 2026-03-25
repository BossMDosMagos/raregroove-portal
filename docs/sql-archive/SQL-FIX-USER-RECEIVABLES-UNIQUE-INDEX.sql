-- =====================================================================
-- FIX: Adicionar índice único a user_receivables para permitir refresh concorrente
-- =====================================================================
-- Erro: "cannot refresh materialized view public.user_receivables concurrently"
-- Causa: REFRESH CONCURRENTLY requer um UNIQUE INDEX
-- Solução: Criar índice único na coluna transaction_id

-- 1️⃣ Criar índice único em user_receivables
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_receivables_transaction_id_unique 
ON user_receivables(transaction_id);

-- 2️⃣ Criar índice único em user_purchases (mesmo problema)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_purchases_transaction_id_unique 
ON user_purchases(transaction_id);

-- 3️⃣ Verificar se os índices foram criados
SELECT 
  schemaname,
  tablename AS materialized_view,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('user_receivables', 'user_purchases')
ORDER BY tablename, indexname;

-- 4️⃣ Testar refresh manual (deve funcionar agora)
REFRESH MATERIALIZED VIEW CONCURRENTLY user_receivables;
REFRESH MATERIALIZED VIEW CONCURRENTLY user_purchases;

SELECT '✅ FIX aplicado com sucesso! Views podem ser atualizadas concorrentemente.' AS status;

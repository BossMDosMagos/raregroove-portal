-- =====================================================================
-- VERIFICAR ESTRUTURA DA TABELA NOTIFICATIONS
-- =====================================================================

-- Ver todas as colunas da tabela notifications
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'notifications'
ORDER BY ordinal_position;

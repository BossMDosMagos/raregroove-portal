-- ============================================================================
-- Verificar se há webhooks ou funções causando o erro 500
-- ============================================================================

-- 1. Ver se há funções/triggers que executam no INSERT de profiles
SELECT 
  trigger_name,
  trigger_schema,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND event_object_table = 'profiles'
AND event_manipulation = 'INSERT';

-- 2. Ver TODAS as funções públicas
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
LIMIT 20;

-- 3. Ver se há hooks/webhooks
SELECT *
FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE '%hook%';

-- 4. Verificar Auth config
SELECT key, value FROM auth.config;

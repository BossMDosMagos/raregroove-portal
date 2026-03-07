-- ============================================================================
-- DIAGNÓSTICO REAL: Verificar triggers e funções no NOSSO código
-- O erro "Database error saving new user" pode ser causado por:
-- - Trigger na tabela profiles executando durante signUp
-- - Função handle_new_user com erro
-- - Constraint na tabela profiles
-- ============================================================================

-- 1. Verificar se há trigger na tabela profiles
SELECT 
  trigger_name,
  event_manipulation as "Quando",
  action_statement as "O que faz"
FROM information_schema.triggers
WHERE event_object_schema = 'public'
AND event_object_table = 'profiles';

-- 2. Verificar se há função handle_new_user
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND (routine_name LIKE '%handle%' OR routine_name LIKE '%new_user%')
ORDER BY routine_name;

-- 3. Verificar constraints UNIQUE na tabela profiles
SELECT
  conname as "Constraint",
  pg_get_constraintdef(oid) as "Definição"
FROM pg_constraint
WHERE conrelid = 'profiles'::regclass
AND contype = 'u';

-- 4. Verificar se RLS está correto na tabela profiles
SELECT 
  tablename,
  rowsecurity as "RLS ativo?"
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'profiles';

-- 5. Ver todas as políticas de profiles
SELECT 
  policyname as "Política",
  cmd as "Comando",
  qual as "USING",
  with_check as "WITH CHECK"
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename = 'profiles'
ORDER BY cmd;

-- ============================================================================
-- SOLUÇÃO: Se houver trigger problemático, desabilitar temporariamente
-- ============================================================================

-- Para desabilitar TODOS os triggers da tabela profiles (se houver):
-- ALTER TABLE profiles DISABLE TRIGGER ALL;

-- Para habilitar novamente depois:
-- ALTER TABLE profiles ENABLE TRIGGER ALL;

-- ============================================================================
-- VERIFICAÇÃO: Estado atual da tabela profiles
-- ============================================================================

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'profiles'
ORDER BY ordinal_position;

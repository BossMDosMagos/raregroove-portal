-- ============================================================================
-- DIAGNÓSTICO AVANÇADO: Erro "Database error saving new user"
-- Este erro acontece ANTES de criar o perfil, durante auth.signUp()
-- ============================================================================

-- 1. Verificar se há triggers no auth.users que podem estar bloqueando
SELECT 
  trigger_schema,
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
AND event_object_table = 'users';

-- 2. Verificar se há políticas RLS no auth.users (não deveria ter)
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE schemaname = 'auth'
AND tablename = 'users';

-- 3. Verificar se auth.users tem RLS habilitado (não deveria ter)
SELECT 
  schemaname,
  tablename,
  rowsecurity as "RLS habilitado?"
FROM pg_tables
WHERE schemaname = 'auth'
AND tablename = 'users';

-- 4. Verificar constraints no auth.users
SELECT
  conname as "Constraint",
  contype as "Tipo",
  CASE contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'c' THEN 'CHECK'
    WHEN 'f' THEN 'FOREIGN KEY'
  END as "Descrição",
  pg_get_constraintdef(oid) as "Definição"
FROM pg_constraint
WHERE conrelid = 'auth.users'::regclass;

-- ============================================================================
-- SOLUÇÃO 1: Garantir que RLS está DESABILITADO em auth.users
-- ============================================================================

-- ATENÇÃO: auth.users NÃO deve ter RLS habilitado!
-- O Supabase gerencia auth.users internamente

ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SOLUÇÃO 2: Remover quaisquer políticas RLS de auth.users
-- ============================================================================

-- Listar e remover todas as políticas (se existirem)
DO $$ 
DECLARE 
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'auth' AND tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON auth.users', pol.policyname);
    RAISE NOTICE 'Política % removida', pol.policyname;
  END LOOP;
END $$;

-- ============================================================================
-- VERIFICAÇÃO: Confirmar que auth.users está sem RLS
-- ============================================================================

SELECT 
  tablename,
  rowsecurity as "RLS?",
  CASE 
    WHEN rowsecurity THEN '❌ ERRO - RLS não deveria estar ativo'
    ELSE '✅ OK - RLS desabilitado'
  END as status
FROM pg_tables
WHERE schemaname = 'auth'
AND tablename = 'users';

-- ============================================================================
-- SOLUÇÃO 3: Verificar se há função/trigger interferindo no signUp
-- ============================================================================

-- Verificar se há função handle_new_user customizada
SELECT 
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%user%'
AND routine_name LIKE '%handle%';

-- ============================================================================
-- TESTE FINAL
-- ============================================================================
-- Após executar este SQL, tente cadastrar novamente
-- Se ainda falhar, verifique os logs do Supabase Dashboard:
-- Dashboard → Logs → Auth Logs
-- Procure por erros relacionados ao signUp

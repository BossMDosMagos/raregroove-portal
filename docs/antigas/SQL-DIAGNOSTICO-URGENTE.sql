-- ============================================================================
-- EXECUTE ESSAS 4 QUERIES E ME ENVIE OS RESULTADOS
-- ============================================================================

-- QUERY 1: Ver se tem TRIGGER na tabela profiles (pode estar causando erro)
SELECT 
  trigger_name,
  event_manipulation as quando,
  action_statement as o_que_faz
FROM information_schema.triggers
WHERE event_object_schema = 'public'
AND event_object_table = 'profiles';


-- QUERY 2: Ver se tem função handle_new_user (pode ter erro dentro dela)
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND (routine_name LIKE '%handle%' OR routine_name LIKE '%new_user%' OR routine_name LIKE '%profile%')
ORDER BY routine_name;


-- QUERY 3: Ver constraints UNIQUE (pode estar duplicando email/cpf/rg)
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as definicao
FROM pg_constraint
WHERE conrelid = 'profiles'::regclass
AND contype = 'u';


-- QUERY 4: Ver políticas RLS de INSERT (pode estar bloqueando)
SELECT 
  policyname,
  cmd,
  qual as usando,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename = 'profiles'
AND cmd = 'INSERT';

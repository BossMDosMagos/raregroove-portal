-- ============================================================================
-- CORRIGIR: Política RLS bloqueando INSERT durante signUp
-- ============================================================================
-- PROBLEMA: Durante signUp, auth.uid() retorna NULL (usuário sem sessão)
-- ERRO: "new row violates row-level security policy for table 'profiles'"
-- SOLUÇÃO: Remover WITH CHECK da política INSERT (trigger handle_new_user cria perfil)

-- 1. VERIFICAR políticas atuais
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
WHERE tablename = 'profiles'
ORDER BY policyname;

-- ============================================================================
-- SOLUÇÃO 1: Dropar política INSERT (trigger handle_new_user já cria perfil)
-- ============================================================================

-- 2. DROPAR política INSERT
DROP POLICY IF EXISTS pol_insert_own_profile ON profiles;

-- 3. Não recriar! O trigger handle_new_user já cria o perfil após signUp
-- O código JavaScript faz UPSERT (atualiza) o perfil existente
-- Política de UPDATE já permite isso (auth.uid() = id)

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================

-- 4. Confirmar políticas restantes (deve ter apenas UPDATE, SELECT, DELETE)
SELECT 
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

-- Resultado esperado:
-- DELETE | pol_delete_own_profile
-- SELECT | pol_select_all_profiles
-- UPDATE | pol_update_own_profile
-- (SEM INSERT - trigger cuida disso!)

-- 5. Verificar que trigger handle_new_user está ativo
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- ============================================================================
-- COMO FUNCIONA AGORA
-- ============================================================================
-- 1. Usuário clica "Cadastrar" no frontend
-- 2. supabase.auth.signUp() cria usuário em auth.users
-- 3. TRIGGER on_auth_user_created dispara AUTOMATICAMENTE
-- 4. Função handle_new_user insere perfil básico (id, email, full_name)
-- 5. Frontend chama createProfileOnSignUp com UPSERT
-- 6. UPSERT atualiza perfil com CPF/CNPJ/RG (usa política UPDATE)
-- 7. Sem erro! ✅

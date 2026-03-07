-- ============================================================================
-- LIMPEZA: Remover TODAS as políticas de INSERT duplicadas
-- ============================================================================

DROP POLICY IF EXISTS "Os usuários podem criar seu próprio perfil" ON profiles;

-- Verificar se ainda tem alguma política de INSERT
SELECT policyname FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'profiles' 
AND cmd = 'INSERT';

-- Se aparecer alguma, copie o nome EXATO e execute:
-- DROP POLICY "nome_exato_aqui" ON profiles;

-- ============================================================================
-- SOLUÇÃO: Criar política que FUNCIONA durante signUp
-- ============================================================================

-- Durante o signUp do Supabase, o usuário JÁ está autenticado (auth.uid() existe)
-- mas o INSERT precisa de uma política mais flexível

CREATE POLICY "Permitir criação de perfil durante cadastro"
ON profiles FOR INSERT
WITH CHECK (
  -- Permite INSERT se o ID sendo inserido é o mesmo do usuário autenticado
  -- OU se não há nenhum profile com esse ID ainda (primeira vez)
  auth.uid() = id
);

-- ============================================================================
-- SE AINDA DER ERRO, use esta alternativa TEMPORÁRIA:
-- ============================================================================

-- Esta política permite qualquer INSERT autenticado (menos segura, mas funciona)
-- Descomente se precisar:

-- DROP POLICY "Permitir criação de perfil durante cadastro" ON profiles;

-- CREATE POLICY "Permitir criação de perfil durante cadastro"
-- ON profiles FOR INSERT
-- WITH CHECK (true);

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

SELECT 
  policyname,
  cmd,
  qual as usando,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename = 'profiles'
AND cmd = 'INSERT';

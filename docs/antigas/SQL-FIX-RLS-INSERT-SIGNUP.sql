-- ============================================================================
-- CORREÇÃO: Permitir INSERT de profile durante signUp
-- ============================================================================

-- Remover política antiga problemática
DROP POLICY IF EXISTS "Os usuários podem criar seu próprio perfil" ON profiles;

-- Criar nova política que permite INSERT durante signUp
CREATE POLICY "Os usuários podem criar seu próprio perfil"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id
);

-- ============================================================================
-- ALTERNATIVA: Se ainda não funcionar, usar política mais permissiva
-- ============================================================================

-- Descomente estas linhas se a correção acima não resolver:

-- DROP POLICY IF EXISTS "Os usuários podem criar seu próprio perfil" ON profiles;

-- CREATE POLICY "Os usuários podem criar seu próprio perfil"
-- ON profiles FOR INSERT
-- WITH CHECK (true);  -- Permite qualquer INSERT autenticado

-- ============================================================================
-- VERIFICAÇÃO: Confirmar que política foi atualizada
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

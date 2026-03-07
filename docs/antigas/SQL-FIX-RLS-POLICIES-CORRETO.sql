-- ============================================================================
-- REABILITAR RLS com políticas CORRETAS para UPDATE
-- ============================================================================

-- 1. Reabilitar RLS em profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Remover todas as políticas antigas problemáticas
DROP POLICY IF EXISTS "Os usuários podem criar seu próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Permitir criação de perfil durante cadastro" ON profiles;
DROP POLICY IF EXISTS "Os usuários podem editar seu próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Os usuários podem ler todos os perfis" ON profiles;

-- 3. Criar política de INSERT (para cadastro)
CREATE POLICY "Usuários podem criar seu próprio perfil"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- 4. Criar política de UPDATE (para editar perfil)
CREATE POLICY "Usuários podem editar seu próprio perfil"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 5. Criar política de SELECT (para ler perfis)
CREATE POLICY "Qualquer um pode ler perfis"
ON profiles FOR SELECT
USING (true);

-- 6. Criar política de DELETE (para deletar perfil próprio)
CREATE POLICY "Usuários podem deletar seu próprio perfil"
ON profiles FOR DELETE
USING (auth.uid() = id);

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================

SELECT 
  policyname,
  cmd,
  qual as usando,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename = 'profiles'
ORDER BY cmd;

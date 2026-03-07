-- ============================================================================
-- LIMPAR: Ver todas as políticas e dropar corretamente
-- ============================================================================

-- 1. Ver TODAS as políticas de profiles
SELECT policyname, cmd FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'profiles';

-- 2. Dropar TODAS as políticas (copie os nomes exatos se necessário)
DROP POLICY IF EXISTS "Usuários podem criar seu próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Os usuários podem criar seu próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Permitir criação de perfil durante cadastro" ON profiles;
DROP POLICY IF EXISTS "Os usuários podem editar seu próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Usuários podem editar seu próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Os usuários podem ler todos os perfis" ON profiles;
DROP POLICY IF EXISTS "Qualquer um pode ler perfis" ON profiles;
DROP POLICY IF EXISTS "Usuários podem deletar seu próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Os usuários podem deletar seu próprio perfil" ON profiles;

-- ============================================================================
-- Reabilitar RLS
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CRIAR POLÍTICAS NOVAS
-- ============================================================================

-- INSERT
CREATE POLICY "pol_insert_own_profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- UPDATE
CREATE POLICY "pol_update_own_profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- SELECT
CREATE POLICY "pol_select_all_profiles"
ON profiles FOR SELECT
USING (true);

-- DELETE
CREATE POLICY "pol_delete_own_profile"
ON profiles FOR DELETE
USING (auth.uid() = id);

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================

SELECT policyname, cmd FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY cmd;

-- ============================================================================
-- POLÍTICAS RLS PARA TABELA PROFILES - RAREGROOVE
-- Execute cada comando NO SUPABASE SQL EDITOR (não em markdown)
-- ============================================================================

-- 1. ATIVAR RLS NA TABELA PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. POLÍTICA: Usuários só podem VER seu próprio perfil (completo)
CREATE POLICY "Usuários podem ver seu próprio perfil"
ON profiles
FOR SELECT
USING (auth.uid() = id);

-- 3. POLÍTICA: Usuários podem VER nomes de outros usuários (para chat)
CREATE POLICY "Usuários podem ver nomes de colecionadores"
ON profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 4. POLÍTICA: Usuários só podem INSERIR seu próprio perfil
CREATE POLICY "Usuários podem criar seu próprio perfil"
ON profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- 5. POLÍTICA: Usuários só podem ATUALIZAR seu próprio perfil
CREATE POLICY "Usuários podem atualizar seu próprio perfil"
ON profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- TESTE DE SEGURANÇA (execute após criar as políticas)
-- ============================================================================
-- SELECT * FROM profiles;
-- Resultado esperado: APENAS seu próprio perfil

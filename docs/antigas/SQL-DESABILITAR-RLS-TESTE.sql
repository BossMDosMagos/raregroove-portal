-- ============================================================================
-- SOLUÇÃO RÁPIDA: Desabilitar RLS temporariamente para testar
-- ============================================================================

-- 1. Desabilitar RLS em profiles temporariamente
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 2. Testar cadastro (vá na aplicação e tente cadastrar)

-- 3. Se funcionar, reabilite RLS e ajuste a política:
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Depois de testar, execute isto para reabilitar com política correta:
-- ============================================================================

-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- DROP POLICY IF EXISTS "Os usuários podem criar seu próprio perfil" ON profiles;

-- CREATE POLICY "Permitir criação de perfil"
-- ON profiles FOR INSERT
-- WITH CHECK (auth.uid() = id);

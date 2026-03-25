-- =====================================================================
-- FIX: Corrigir RLS da tabela REVIEWS para permitir avaliações
-- =====================================================================
-- Erro: "new row violates row-level security policy for table 'reviews'"
-- Causa: Falta política INSERT permitindo compradores avaliarem vendedores
-- Solução: Adicionar política correta

-- 1. Ver políticas atuais
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
WHERE tablename = 'reviews'
ORDER BY policyname;

-- 2. Dropar políticas antigas que podem estar erradas
DROP POLICY IF EXISTS "Users can insert their own reviews" ON reviews;
DROP POLICY IF EXISTS "Compradores podem avaliar" ON reviews;
DROP POLICY IF EXISTS "Usuarios podem criar avaliacoes" ON reviews;

-- 3. Criar política correta para INSERT
-- Permite que usuários autenticados criem avaliações onde eles são o reviewer
CREATE POLICY "Usuarios podem criar avaliacoes"
  ON reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reviewer_id);

-- 4. Garantir que usuários possam ver avaliações públicas
DROP POLICY IF EXISTS "Reviews sao publicas" ON reviews;
CREATE POLICY "Reviews sao publicas"
  ON reviews
  FOR SELECT
  TO authenticated
  USING (true);

-- 5. Permitir atualizar próprias avaliações
DROP POLICY IF EXISTS "Usuarios podem atualizar proprias avaliacoes" ON reviews;
CREATE POLICY "Usuarios podem atualizar proprias avaliacoes"
  ON reviews
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = reviewer_id)
  WITH CHECK (auth.uid() = reviewer_id);

-- 6. Verificar resultado
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'reviews'
ORDER BY cmd, policyname;

SELECT '✅ RLS da tabela REVIEWS corrigido! Usuários podem criar avaliações.' AS status;

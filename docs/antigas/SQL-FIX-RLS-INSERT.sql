-- ============================================================================
-- CORREÇÃO: Políticas RLS para permitir cadastro de novos usuários
-- Execute este SQL para resolver o erro "Database error saving new user"
-- ============================================================================

-- 1. Verificar políticas atuais de INSERT
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as "Condição USING",
  with_check as "Condição WITH CHECK"
FROM pg_policies 
WHERE tablename = 'profiles' 
AND cmd = 'INSERT';

-- ============================================================================
-- SOLUÇÃO: Recriar política de INSERT permitindo novos usuários
-- ============================================================================

-- 2. Remover política antiga de INSERT (se existir)
DROP POLICY IF EXISTS "Usuários podem criar seu próprio perfil" ON profiles;

-- 3. Criar nova política de INSERT que funciona corretamente
CREATE POLICY "Usuários podem criar seu próprio perfil"
ON profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- EXPLICAÇÃO:
-- WITH CHECK garante que o usuário só pode inserir um perfil com o próprio UUID
-- Isso permite que createProfileOnSignUp funcione após o signUp bem-sucedido

-- ============================================================================
-- TESTE: Verificar se a política foi criada corretamente
-- ============================================================================

SELECT 
  policyname,
  cmd,
  with_check as "Condição"
FROM pg_policies 
WHERE tablename = 'profiles' 
AND policyname = 'Usuários podem criar seu próprio perfil';

-- Deve retornar:
-- policyname: "Usuários podem criar seu próprio perfil"
-- cmd: INSERT
-- Condição: (auth.uid() = id)

-- ============================================================================
-- VERIFICAÇÃO FINAL: Tentar cadastrar novamente
-- ============================================================================
-- Após executar este SQL, vá na tela de cadastro e tente criar o usuário novamente

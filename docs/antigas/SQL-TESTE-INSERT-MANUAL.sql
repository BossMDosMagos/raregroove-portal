-- ============================================================================
-- TESTE DIRETO: Simular cadastro manualmente para identificar o problema
-- Execute este SQL para testar se consegue inserir um perfil diretamente
-- ============================================================================

-- 1. Ver estrutura da tabela profiles
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- ============================================================================
-- 2. TESTE: Tentar inserir um perfil de teste manualmente
-- ============================================================================

-- ATENÇÃO: Substitua o UUID abaixo por um UUID válido de um usuário em auth.users
-- Para pegar um UUID válido, execute:
SELECT id FROM auth.users WHERE email = 'seu-email-admin@gmail.com';

-- Depois substitua abaixo e execute:
/*
INSERT INTO profiles (
  id,
  email,
  full_name,
  cpf_cnpj,
  rg
) VALUES (
  'cole-o-uuid-aqui',
  'teste@exemplo.com',
  'Usuário de Teste',
  '12345678901',
  '1234567'
);
*/

-- ============================================================================
-- 3. Verificar triggers na tabela profiles
-- ============================================================================

SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'profiles';

-- ============================================================================
-- 4. Verificar constraints (restrições)
-- ============================================================================

SELECT
  conname as "Nome da Constraint",
  contype as "Tipo",
  CASE contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'c' THEN 'CHECK'
    WHEN 'f' THEN 'FOREIGN KEY'
  END as "Descrição"
FROM pg_constraint
WHERE conrelid = 'profiles'::regclass;

-- ============================================================================
-- INTERPRETAÇÃO DOS RESULTADOS:
-- ============================================================================
-- Se TESTE falhar → Problema é na tabela/RLS
-- Se triggers aparecerem → Podem estar bloqueando INSERT
-- Se constraints UNIQUE duplicadas → Podem estar causando conflito
-- ============================================================================

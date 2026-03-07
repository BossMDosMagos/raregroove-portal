-- ============================================================================
-- LIMPAR: Perfil órfão do usuário rmaneiro2023@gmail.com
-- ============================================================================

-- 1. VERIFICAR o perfil órfão atual (sem CPF/CNPJ e RG)
SELECT 
  id,
  email,
  full_name,
  cpf_cnpj,
  rg,
  phone,
  created_at
FROM profiles
WHERE email = 'rmaneiro2023@gmail.com';

-- 2. VERIFICAR se existe em auth.users
SELECT 
  id,
  email,
  created_at,
  email_confirmed_at
FROM auth.users
WHERE email = 'rmaneiro2023@gmail.com';

-- ============================================================================
-- SOLUÇÃO: Deletar perfil órfão E usuário em auth.users
-- Isso permite cadastro limpo com todos os dados
-- ============================================================================

-- Passo 1: Deletar da tabela profiles
DELETE FROM profiles 
WHERE id = '0caea3a8-1db9-4a73-a0b4-bbe465056bc3'
AND email = 'rmaneiro2023@gmail.com';

-- Passo 2: Deletar de auth.users (permite cadastro novo)
DELETE FROM auth.users 
WHERE id = '0caea3a8-1db9-4a73-a0b4-bbe465056bc3'
AND email = 'rmaneiro2023@gmail.com';

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

-- Confirmar que foi deletado
SELECT COUNT(*) as perfis_rmaneiro 
FROM profiles 
WHERE email = 'rmaneiro2023@gmail.com';
-- Deve retornar 0

SELECT COUNT(*) as auth_rmaneiro 
FROM auth.users 
WHERE email = 'rmaneiro2023@gmail.com';
-- Deve retornar 0

-- Verificar total de perfis
SELECT 
  CASE 
    WHEN cpf_cnpj IS NOT NULL AND cpf_cnpj != '' THEN 'COM CPF/CNPJ'
    ELSE 'SEM CPF/CNPJ'
  END as tipo,
  COUNT(*) as quantidade
FROM profiles
GROUP BY tipo;

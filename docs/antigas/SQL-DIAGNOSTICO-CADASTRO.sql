-- ============================================================================
-- DIAGNÓSTICO: Verificar se o email josemyrso@gmail.com ainda está no sistema
-- Execute este SQL para entender o problema de cadastro
-- ============================================================================

-- 1. Verificar se existe em auth.users
SELECT 
  'auth.users' as tabela,
  id,
  email,
  created_at,
  email_confirmed_at,
  'Usuário existe em auth.users - PRECISA DELETAR' as status
FROM auth.users 
WHERE email = 'josemyrso@gmail.com';

-- 2. Verificar se existe em profiles
SELECT 
  'profiles' as tabela,
  id,
  email,
  full_name,
  cpf_cnpj,
  'Perfil existe em profiles - OK' as status
FROM profiles 
WHERE email = 'josemyrso@gmail.com';

-- 3. Verificar CPF/CNPJ duplicado
SELECT 
  'profiles (CPF)' as tabela,
  id,
  email,
  full_name,
  cpf_cnpj,
  'CPF/CNPJ já cadastrado em outro perfil' as status
FROM profiles 
WHERE cpf_cnpj = '93125224772';

-- 4. Verificar RG duplicado
SELECT 
  'profiles (RG)' as tabela,
  id,
  email,
  full_name,
  rg,
  'RG já cadastrado em outro perfil' as status
FROM profiles 
WHERE rg = '080051445';

-- ============================================================================
-- INTERPRETAÇÃO:
-- ============================================================================
-- Se retornar algo em auth.users → Execute SQL-FIX-USUARIO-ORFAO.sql PASSO 2
-- Se retornar CPF/RG duplicado → Outro usuário usa esses documentos
-- Se não retornar nada → Email/CPF/RG livres para cadastro
-- ============================================================================

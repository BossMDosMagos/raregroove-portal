-- ============================================================================
-- DIAGNÓSTICO: Usuários com problemas de autenticação e duplicação
-- ============================================================================

-- 1. Verificar usuários em auth.users SEM profile correspondente (órfãos)
SELECT 
  au.id,
  au.email,
  au.created_at,
  CASE WHEN p.id IS NULL THEN '❌ SEM PROFILE' ELSE '✅ COM PROFILE' END as status
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
ORDER BY au.created_at DESC;

-- 2. Verificar usuários com CPF/CNPJ duplicado
SELECT 
  cpf_cnpj,
  COUNT(*) as qtd_usuarios,
  STRING_AGG(id::text, ', ') as ids,
  STRING_AGG(email, ', ') as emails
FROM profiles
WHERE cpf_cnpj IS NOT NULL AND cpf_cnpj != ''
GROUP BY cpf_cnpj
HAVING COUNT(*) > 1;

-- 3. Verificar constraints UNIQUE na tabela profiles
SELECT
  tc.constraint_name,
  kcu.column_name,
  tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'profiles'
  AND tc.constraint_type = 'UNIQUE'
ORDER BY tc.constraint_name;

-- 4. Verificar dados do usuário rmaneiro2023@gmail.com
SELECT 
  id,
  email,
  full_name,
  cpf_cnpj,
  phone,
  address,
  created_at
FROM profiles
WHERE email = 'rmaneiro2023@gmail.com';

-- 5. Verificar se existe em auth.users
SELECT 
  id,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users
WHERE email = 'rmaneiro2023@gmail.com';

-- 6. Verificar todos os perfis criados recentemente (últimas 24h)
SELECT 
  id,
  email,
  full_name,
  cpf_cnpj,
  phone,
  created_at
FROM profiles
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

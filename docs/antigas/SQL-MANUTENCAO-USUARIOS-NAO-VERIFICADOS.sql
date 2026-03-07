-- ============================================================================
-- MANUTENÇÃO: Limpar usuários não verificados (órfãos)
-- ============================================================================
-- ⚠️⚠️⚠️ IMPORTANTE: Execute SQL-PROTEGER-ADMIN-ANTES-LIMPEZA.sql PRIMEIRO! ⚠️⚠️⚠️
-- Isso garante que seu admin não será deletado acidentalmente
-- ============================================================================

-- Execute este SQL periodicamente para limpar usuários que se cadastraram
-- mas nunca validaram o email

-- 1. VISUALIZAR usuários não confirmados (mais de 24h)
SELECT 
  au.id,
  au.email,
  au.created_at,
  au.email_confirmed_at,
  au.last_sign_in_at,
  EXTRACT(EPOCH FROM (NOW() - au.created_at))/3600 as horas_desde_cadastro
FROM auth.users au
WHERE au.email_confirmed_at IS NULL
  AND au.created_at < NOW() - INTERVAL '24 hours'
ORDER BY au.created_at DESC;

-- 2. CONTAR usuários não confirmados
SELECT 
  COUNT(*) as usuarios_nao_confirmados
FROM auth.users
WHERE email_confirmed_at IS NULL
  AND created_at < NOW() - INTERVAL '24 hours';

-- ============================================================================
-- LIMPEZA (Execute apenas após revisar os resultados acima)
-- ============================================================================
-- ⚠️ IMPORTANTE: Execute SQL-PROTEGER-ADMIN-ANTES-LIMPEZA.sql ANTES deste!

-- 3. DELETAR perfis de usuários não confirmados (mais de 7 dias)
-- PROTEGE ADMINS: Nunca deleta se is_admin = true
DELETE FROM profiles
WHERE id IN (
  SELECT au.id
  FROM auth.users au
  LEFT JOIN profiles p ON p.id = au.id
  WHERE au.email_confirmed_at IS NULL
    AND au.created_at < NOW() - INTERVAL '7 days'
    AND (p.is_admin IS NULL OR p.is_admin = false) -- ⚠️ PROTEÇÃO ADMIN
);

-- 4. DELETAR usuários não confirmados (mais de 7 dias)
-- PROTEGE ADMINS: Nunca deleta se is_admin = true
DELETE FROM auth.users
WHERE email_confirmed_at IS NULL
  AND created_at < NOW() - INTERVAL '7 days'
  AND id NOT IN ( -- ⚠️ PROTEÇÃO ADMIN
    SELECT id FROM profiles WHERE is_admin = true
  );

-- ============================================================================
-- VERIFICAÇÕES PÓS-LIMPEZA
-- ============================================================================

-- 5. Verificar usuários válidos (com email confirmado)
SELECT 
  COUNT(*) as usuarios_validados,
  COUNT(DISTINCT email) as emails_unicos
FROM auth.users
WHERE email_confirmed_at IS NOT NULL;

-- 6. Verificar consistência: usuários confirmados devem ter profile
SELECT 
  au.id,
  au.email,
  au.email_confirmed_at,
  CASE WHEN p.id IS NULL THEN '❌ SEM PROFILE' ELSE '✅ COM PROFILE' END as status_profile
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE au.email_confirmed_at IS NOT NULL
ORDER BY au.created_at DESC;

-- ============================================================================
-- REENVIAR CÓDIGO MANUALMENTE (uso admin)
-- ============================================================================
-- Se um usuário específico reclamou que não recebeu email,
-- você pode reenviar usando este SQL (requer acesso ao Supabase Dashboard)

-- Verificar status do usuário
-- SELECT 
--   id,
--   email,
--   email_confirmed_at,
--   created_at,
--   confirmation_sent_at
-- FROM auth.users
-- WHERE email = 'email-do-usuario@exemplo.com';

-- Para reenviar, o usuário deve tentar cadastrar novamente OU
-- usar a opção "Reenviar código" na tela de verificação

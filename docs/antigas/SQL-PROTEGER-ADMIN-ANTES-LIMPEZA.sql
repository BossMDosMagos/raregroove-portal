-- ============================================================================
-- PROTEGER ADMIN: Confirmar email do admin criado antes da validação OTP
-- ============================================================================
-- ⚠️ EXECUTAR ESTE SQL ANTES DE QUALQUER LIMPEZA!
-- Este SQL marca o email do admin como confirmado para ele não ser deletado

-- 1. VERIFICAR status atual do admin
SELECT 
  au.id,
  au.email,
  au.email_confirmed_at,
  au.created_at,
  p.is_admin,
  p.full_name,
  CASE 
    WHEN au.email_confirmed_at IS NULL THEN '⚠️ NÃO CONFIRMADO (RISCO DE SER DELETADO)'
    ELSE '✅ CONFIRMADO (SEGURO)'
  END as status_risco
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE p.is_admin = true
ORDER BY au.created_at;

-- 2. VERIFICAR todos os admins não confirmados
SELECT 
  COUNT(*) as admins_em_risco
FROM auth.users au
JOIN profiles p ON p.id = au.id
WHERE p.is_admin = true
  AND au.email_confirmed_at IS NULL;

-- ============================================================================
-- SOLUÇÃO: Confirmar email dos admins manualmente
-- ============================================================================

-- 3. CONFIRMAR email de TODOS os admins automaticamente
UPDATE auth.users
SET 
  email_confirmed_at = NOW(),
  updated_at = NOW()
WHERE id IN (
  SELECT au.id
  FROM auth.users au
  JOIN profiles p ON p.id = au.id
  WHERE p.is_admin = true
    AND au.email_confirmed_at IS NULL
);

-- ============================================================================
-- VERIFICAÇÃO PÓS-PROTEÇÃO
-- ============================================================================

-- 4. Confirmar que todos os admins estão seguros agora
SELECT 
  au.id,
  au.email,
  au.email_confirmed_at,
  p.is_admin,
  p.full_name,
  CASE 
    WHEN au.email_confirmed_at IS NOT NULL THEN '✅ PROTEGIDO'
    ELSE '❌ AINDA EM RISCO'
  END as status
FROM auth.users au
JOIN profiles p ON p.id = au.id
WHERE p.is_admin = true
ORDER BY au.created_at;

-- ============================================================================
-- ALTERNATIVA: Confirmar email de um admin específico
-- (Use se souber o email do admin)
-- ============================================================================

-- UPDATE auth.users
-- SET 
--   email_confirmed_at = NOW(),
--   updated_at = NOW()
-- WHERE email = 'seu-email-admin@gmail.com';

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================
-- ✅ Este SQL não deleta nada, apenas marca como confirmado
-- ✅ Só afeta usuários com is_admin = true
-- ✅ Seguro executar múltiplas vezes
-- ✅ Execute ANTES de qualquer script de limpeza
-- ✅ Após executar, seu admin nunca será deletado por scripts de manutenção

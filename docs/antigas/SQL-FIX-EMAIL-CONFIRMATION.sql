-- ============================================================================
-- SOLUÇÃO ALTERNATIVA: Desabilitar confirmação de email
-- O erro "Database error saving new user" pode ser causado por:
-- 1. Configuração de email não completada
-- 2. RLS incorreto em auth.users
-- 3. Trigger interferindo
-- ============================================================================

-- IMPORTANTE: Execute esta query para verificar sua configuração de Auth
SELECT 
  'Email Confirmado Requerido?' as configuracao,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM auth.users WHERE email_confirmed_at IS NULL
    ) THEN 'SIM - Usuários precisam confirmar email'
    ELSE 'NÃO - Confirmação automática'
  END as valor;

-- ============================================================================
-- Para desabilitar a confirmação de email via SQL:
-- (Alternativa se não conseguir via Dashboard)
-- ============================================================================

-- ATENÇÃO: Isso permite cadastro sem confirmar email
-- Útil para desenvolvimento/testes

-- Esta configuração fica no Dashboard do Supabase:
-- Authentication → Settings → Email Auth
-- Desmarque: "Enable email confirmations"

-- ============================================================================
-- DIAGNÓSTICO: Ver usuários que falharam ao se cadastrar
-- ============================================================================

SELECT 
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at,
  CASE 
    WHEN email_confirmed_at IS NULL THEN '⚠️ Email não confirmado'
    WHEN last_sign_in_at IS NULL THEN '⚠️ Nunca fez login'
    ELSE '✅ Ativo'
  END as status
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- LIMPEZA: Remover usuários que foram criados mas falharam
-- (Execute apenas se houver usuários órfãos de testes falhados)
-- ============================================================================

-- Ver usuários criados nas últimas 2 horas sem perfil
SELECT 
  u.id,
  u.email,
  u.created_at,
  'Usuário criado mas sem perfil' as problema
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL
AND u.created_at > NOW() - INTERVAL '2 hours'
ORDER BY u.created_at DESC;

-- Para deletar esses usuários órfãos:
/*
DELETE FROM auth.users
WHERE id IN (
  SELECT u.id
  FROM auth.users u
  LEFT JOIN profiles p ON u.id = p.id
  WHERE p.id IS NULL
  AND u.created_at > NOW() - INTERVAL '2 hours'
);
*/

-- ============================================================================
-- CHECKLIST DE CONFIGURAÇÃO DO SUPABASE DASHBOARD
-- ============================================================================
/*
Vá em: Authentication → Providers → Email

✅ Email Provider: Habilitado
✅ Confirm email: Desabilitado (para desenvolvimento)
✅ Secure email change: Desabilitado (para desenvolvimento)
✅ Double confirm email change: Desabilitado

Vá em: Authentication → URL Configuration

✅ Site URL: http://localhost:5174 (ou sua URL de dev)
✅ Redirect URLs: http://localhost:5174/** (permitir todos)

Vá em: Authentication → Email Templates

✅ Confirm signup: Pode deixar padrão
*/

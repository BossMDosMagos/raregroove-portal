-- ============================================================================
-- SOLUÇÃO MAIS PROVÁVEL: Configuração de Email
-- O erro "Database error saving new user" geralmente é causado por:
-- Configuração de email incompleta no Supabase
-- ============================================================================

-- ⚠️ IMPORTANTE: Este SQL é apenas para DIAGNÓSTICO
-- A correção real deve ser feita no DASHBOARD do Supabase

-- ============================================================================
-- PASSO 1: Verifique no Dashboard do Supabase
-- ============================================================================

/*
1. Acesse: https://supabase.com/dashboard

2. Selecione seu projeto

3. Vá em: Authentication → Providers → Email

4. Configure:
   ✅ Enable Email provider: ON
   ❌ Confirm email: OFF (desabilite para desenvolvimento)
   
5. Vá em: Authentication → URL Configuration
   
6. Configure:
   Site URL: http://localhost:5174
   Redirect URLs: http://localhost:5174/**
   
7. SALVE as alterações

8. Aguarde 1-2 minutos para propagar

9. Tente cadastrar novamente
*/

-- ============================================================================
-- PASSO 2: Diagnóstico via SQL (apenas para ver configurações)
-- ============================================================================

-- Ver configurações de auth (pode dar erro se não tiver permissão)
SELECT 
  name,
  value
FROM pg_settings
WHERE name LIKE '%auth%'
OR name LIKE '%email%'
LIMIT 10;

-- ============================================================================
-- PASSO 3: Ver usuários recentes (para ver se algum foi criado)
-- ============================================================================

SELECT 
  id,
  email,
  created_at,
  email_confirmed_at,
  CASE 
    WHEN email_confirmed_at IS NULL THEN '❌ Email não confirmado'
    ELSE '✅ Email confirmado'
  END as status,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- PASSO 4: Se houver usuários órfãos de testes, limpar
-- ============================================================================

-- Ver usuários sem perfil (criados mas falharam)
SELECT 
  u.id,
  u.email,
  u.created_at,
  '⚠️ Usuário sem perfil - pode deletar' as status
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL
ORDER BY u.created_at DESC;

-- Para deletar um usuário específico pelo email (apenas se for teste):
-- DELETE FROM auth.users WHERE email = 'email-de-teste@exemplo.com';

-- ============================================================================
-- RESUMO DAS AÇÕES
-- ============================================================================

/*
✅ O QUE FAZER:

1. Acesse o Dashboard do Supabase
2. Authentication → Providers → Email
3. Desabilite "Confirm email"
4. Configure Site URL: http://localhost:5174
5. Salve e aguarde 1-2 minutos
6. Tente cadastrar novamente

🔍 SE AINDA DER ERRO:

Verifique os LOGS no dashboard:
- Dashboard → Logs → Auth Logs
- Procure por mensagens de erro relacionadas ao signUp
- Copie o erro completo e me mostre
*/

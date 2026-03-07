-- ============================================================================
-- DIAGNÓSTICO: Email Rate Limit do Supabase
-- ============================================================================

-- PROBLEMA:
-- "Email rate limit exceeded" significa que o Supabase bloqueou emails
-- Limite típico: 4 emails por hora por usuário
-- Limite total: Depende do plano Supabase

-- CAUSAS POSSÍVEIS:
-- 1. Usuário tentou cadastrar múltiplas vezes (mesmo email)
-- 2. Tentou reenviar código várias vezes
-- 3. Sistema enviou email duplicado (trigger disparou 2x)
-- 4. Testou com muitos usuários diferentes

-- ============================================================================
-- SOLUÇÃO 1: AGUARDAR COOLDOWN (Rápido)
-- ============================================================================

-- Simplesmente aguarde 1-2 horas
-- Depois tente cadastra com EMAIL DIFERENTE
-- Ou mesma email (pode funcionar após 1h)

-- ============================================================================
-- SOLUÇÃO 2: USAR EMAIL CUSTOMIZADO (Recomendado)
-- ============================================================================

-- Configure um serviço de email próprio no Supabase:
-- 
-- 1. Crie conta em: https://resend.com (grátis até 3000 emails/mês)
-- 2. Obtenha API Key
-- 3. No Dashboard Supabase:
--    - Authentication → SMTP Settings
--    - Enable Custom SMTP
--    - Host: smtp.resend.com
--    - Port: 465
--    - User: resend
--    - Pass: [sua API Key]
--    - From: noreply@seudominio.com
--
-- Vantagens:
-- - Limite muito maior (centenas de emails/dia)
-- - Você controla limite
-- - Email com sua marca

-- ============================================================================
-- SOLUÇÃO 3: IMPLEMENTAR COOLDOWN NO FRONTEND (Agora)
-- ============================================================================

-- Adicionar time delay entre tentativas de cadastro
-- Mostrar mensagem: "Aguarde X segundos antes de tentar novamente"

-- Arquivo a editar: src/pages/Auth/Login.jsx
-- Adicionar estado: const [signUpCooldown, setSignUpCooldown] = useState(0)
-- Implementar lógica de cooldown antes de chamar signUp

-- ============================================================================
-- MONITORAR E LIMPAR (Futuro)
-- ============================================================================

-- Ver usuários com email_confirmed_at NULL (não confirmaram)
SELECT 
  au.email,
  au.created_at,
  EXTRACT(EPOCH FROM (NOW() - au.created_at))/3600 as horas_desde_cadastro,
  COUNT(*) as total_tentativas
FROM auth.users au
WHERE au.email_confirmed_at IS NULL
GROUP BY au.email, au.created_at
HAVING COUNT(*) > 1
ORDER BY total_tentativas DESC;

-- Limpar usuários antigos não confirmados (7+ dias)
DELETE FROM profiles
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE email_confirmed_at IS NULL 
  AND created_at < NOW() - INTERVAL '7 days'
);

DELETE FROM auth.users
WHERE email_confirmed_at IS NULL 
AND created_at < NOW() - INTERVAL '7 days';

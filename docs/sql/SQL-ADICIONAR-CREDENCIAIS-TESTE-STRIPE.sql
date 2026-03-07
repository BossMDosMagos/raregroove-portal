-- ============================================================================
-- ADICIONAR CREDENCIAIS DE TESTE DO STRIPE (SANDBOX)
-- ============================================================================
-- Execute este script para ativar o Stripe em modo teste
-- Estas são chaves públicas de exemplo - substitua pelas suas credenciais

-- PASSO 1: Adicionar credenciais do Stripe em modo SANDBOX
UPDATE platform_settings
SET 
  stripe_publishable_key_sandbox = 'pk_test_SUA_CHAVE_PUBLICA_AQUI',
  stripe_secret_key_sandbox = 'sk_test_SUA_CHAVE_SECRETA_AQUI',
  stripe_webhook_secret_sandbox = 'whsec_SEU_WEBHOOK_SECRET_AQUI',
  gateway_mode = 'sandbox',
  gateway_provider = 'stripe',
  updated_at = NOW()
WHERE id = 1;

-- PASSO 2: Verificar se foi atualizado
SELECT 
  id,
  gateway_mode,
  gateway_provider,
  SUBSTRING(stripe_publishable_key_sandbox, 1, 30) as "Pub Key (primeiros 30 chars)",
  CASE WHEN stripe_secret_key_sandbox IS NOT NULL THEN '✅ Configurado' ELSE '❌ Não configurado' END as "Secret Key"
FROM platform_settings
WHERE id = 1;

-- ============================================================================
-- ⚠️ IMPORTANTE: SUBSTITUA PELAS SUAS CHAVES REAIS
-- ============================================================================
-- As chaves acima são EXEMPLOS
-- 
-- Para obter suas chaves reais:
-- 1. Acesse https://dashboard.stripe.com/test/apikeys
-- 2. Copie a "Publishable key" (começa com pk_test_)
-- 3. Copie a "Secret key" (começa com sk_test_)
-- 4. Substitua no UPDATE acima
-- 5. Execute novamente

-- PASSO 3 (Opcional): Se quiser testar com outras gateways depois
-- Para Mercado Pago:
-- UPDATE platform_settings SET 
--   mp_public_key_sandbox = 'APP_USR-SEU_CODIGO_PUBLICO',
--   mp_access_token_sandbox = 'TEST-SEU_TOKEN_ACESSO'
-- WHERE id = 1;

-- Para PayPal:
-- UPDATE platform_settings SET 
--   paypal_client_id_sandbox = 'AVA_SEU_CLIENT_ID',
--   paypal_client_secret_sandbox = 'SEU_CLIENT_SECRET'
-- WHERE id = 1;

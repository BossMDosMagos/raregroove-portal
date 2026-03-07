-- ============================================================================
-- SCRIPT DE EMERGÊNCIA - ATIVAR GATEWAYS COM CREDENCIAIS PLACEHOLDER
-- ============================================================================
-- Execute este SQL no Supabase para fazer os 3 botões aparecerem AGORA
-- Depois você substitui pelas credenciais reais

-- PASSO 1: Deletar qualquer configuração existente (seguro)
DELETE FROM platform_settings WHERE id = 1;

-- PASSO 2: Inserir configuração COMPLETA com credenciais placeholder
INSERT INTO platform_settings (
  id,
  gateway_mode,
  gateway_provider,
  
  -- STRIPE SANDBOX (placeholder)
  stripe_publishable_key_sandbox,
  stripe_secret_key_sandbox,
  stripe_webhook_secret_sandbox,
  
  -- MERCADO PAGO SANDBOX (placeholder)
  mp_public_key_sandbox,
  mp_access_token_sandbox,
  
  -- PAYPAL SANDBOX (placeholder)
  paypal_client_id_sandbox,
  paypal_client_secret_sandbox,
  
  -- TAXAS E CONFIGURAÇÕES
  sale_fee_pct,
  processing_fee_fixed,
  insurance_percentage,
  swap_guarantee_fee_fixed,
  default_shipping_from_cep,
  
  created_at,
  updated_at
)
VALUES (
  1,
  'sandbox',
  'stripe',
  
  -- STRIPE (credenciais placeholder - substitua depois)
  'pk_test_PLACEHOLDER_KEY_REPLACE_THIS',
  'sk_test_PLACEHOLDER_KEY_REPLACE_THIS',
  'whsec_PLACEHOLDER_KEY_REPLACE_THIS',
  
  -- MERCADO PAGO (credenciais placeholder - substitua depois)
  'APP_USR-PLACEHOLDER_KEY_REPLACE_THIS',
  'TEST-PLACEHOLDER_KEY_REPLACE_THIS',
  
  -- PAYPAL (credenciais placeholder - substitua depois)
  'AV_PLACEHOLDER_KEY_REPLACE_THIS',
  'EP_PLACEHOLDER_KEY_REPLACE_THIS',
  
  -- TAXAS
  10,    -- 10% taxa de venda
  2.0,   -- R$ 2.00 taxa fixa
  5,     -- 5% seguro
  5.0,   -- R$ 5.00 garantia
  '01311100',  -- CEP padrão
  
  NOW(),
  NOW()
);

-- PASSO 3: Confirmar que foi criado
SELECT 
  id,
  gateway_mode,
  gateway_provider,
  CASE WHEN stripe_publishable_key_sandbox IS NOT NULL THEN '✅ Stripe' ELSE '❌' END as "Stripe",
  CASE WHEN mp_public_key_sandbox IS NOT NULL THEN '✅ Mercado Pago' ELSE '❌' END as "Mercado Pago",
  CASE WHEN paypal_client_id_sandbox IS NOT NULL THEN '✅ PayPal' ELSE '❌' END as "PayPal"
FROM platform_settings 
WHERE id = 1;

-- ✅ PRONTO! Agora volte ao checkout - os 3 botões devem aparecer!
-- ⚠️ Os pagamentos ainda NÃO vão funcionar porque as chaves são fake
-- 📝 Substitua pelas chaves reais depois conforme os guias

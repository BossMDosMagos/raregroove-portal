-- ============================================================================
-- LIMPAR DADOS DE TESTE E MANTER APENAS PRODUCTION
-- ============================================================================
-- Remove as chaves fake "FAKE" e "PLACEHOLDER" de sandbox
-- Mantém apenas as chaves reais de production

UPDATE platform_settings
SET 
  -- Limpar SANDBOX (dados fake)
  mp_public_key_sandbox = NULL,
  mp_access_token_sandbox = NULL,
  stripe_publishable_key_sandbox = NULL,
  stripe_secret_key_sandbox = NULL,
  stripe_webhook_secret_sandbox = NULL,
  paypal_client_id_sandbox = NULL,
  paypal_client_secret_sandbox = NULL,
  
  -- Garantir modo de PRODUCTION
  gateway_mode = 'production'
WHERE id = 1;

-- Confirmar os dados limpos
SELECT 
  '✅ Dados de teste removidos' as status,
  gateway_mode,
  CASE 
    WHEN stripe_publishable_key_production IS NOT NULL AND stripe_publishable_key_production NOT LIKE '%FAKE%'
    THEN '✅ Stripe REAL'
    ELSE '❌ Sem Stripe'
  END as "Stripe",
  CASE 
    WHEN mp_public_key_production IS NOT NULL AND mp_public_key_production NOT LIKE '%FAKE%'
    THEN '✅ Mercado Pago REAL'
    ELSE '❌ Sem Mercado Pago'
  END as "Mercado Pago",
  CASE 
    WHEN paypal_client_id_production IS NOT NULL AND paypal_client_id_production NOT LIKE '%FAKE%'
    THEN '✅ PayPal REAL'
    ELSE '❌ Sem PayPal'
  END as "PayPal"
FROM platform_settings
WHERE id = 1;

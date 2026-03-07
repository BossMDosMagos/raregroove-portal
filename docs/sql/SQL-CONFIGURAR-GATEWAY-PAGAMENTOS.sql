-- ============================================================================
-- VERIFICAR E CONFIGURAR GATEWAY DE PAGAMENTOS
-- ============================================================================
-- Execute estes comandos um de cada vez no Supabase SQL Editor
-- ============================================================================

-- PASSO 1: Ver configuração atual
SELECT 
  gateway_provider,
  gateway_mode,
  sale_fee_pct,
  processing_fee_fixed,
  insurance_percentage,
  -- Stripe
  stripe_publishable_key_sandbox IS NOT NULL as "Stripe Sandbox Config",
  stripe_secret_key_sandbox IS NOT NULL as "Stripe Secret OK",
  -- Mercado Pago
  mp_public_key_sandbox IS NOT NULL as "Mercado Pago Config",
  mp_access_token_sandbox IS NOT NULL as "MP Token OK",
  -- PayPal  
  paypal_client_id_sandbox IS NOT NULL as "PayPal Config",
  paypal_client_secret_sandbox IS NOT NULL as "PayPal Secret OK"
FROM platform_settings
WHERE id = 1;

-- ============================================================================
-- PASSO 2: CONFIGURAR STRIPE (substituir pelos seus valores)
-- ============================================================================

UPDATE platform_settings
SET 
  gateway_provider = 'stripe',
  gateway_mode = 'sandbox',
  stripe_publishable_key_sandbox = 'pk_test_SEU_PUBLISHABLE_KEY_AQUI',
  stripe_secret_key_sandbox = 'sk_test_SEU_SECRET_KEY_AQUI',
  stripe_webhook_secret_sandbox = 'whsec_SEU_WEBHOOK_SECRET_AQUI'
WHERE id = 1;

-- ============================================================================
-- PASSO 3: CONFIGURAR MERCADO PAGO (substituir pelos seus valores)
-- ============================================================================

UPDATE platform_settings
SET 
  gateway_provider = 'mercado_pago',
  gateway_mode = 'sandbox',
  mp_public_key_sandbox = 'APP_USR_SEU_PUBLIC_KEY_AQUI',
  mp_access_token_sandbox = 'SEU_ACCESS_TOKEN_AQUI'
WHERE id = 1;

-- ============================================================================
-- PASSO 4: CONFIGURAR PAYPAL (substituir pelos seus valores)
-- ============================================================================

UPDATE platform_settings
SET 
  gateway_provider = 'paypal',
  gateway_mode = 'sandbox',
  paypal_client_id_sandbox = 'SEU_CLIENT_ID_AQUI',
  paypal_client_secret_sandbox = 'SEU_CLIENT_SECRET_AQUI'
WHERE id = 1;

-- ============================================================================
-- PASSO 5: CONFIGURAR TAXAS (PADRÃO - CUSTOMIZE CONFORME NECESSÁRIO)
-- ============================================================================

UPDATE platform_settings
SET 
  sale_fee_pct = 10,                    -- 10% de taxa de plataforma
  processing_fee_fixed = 2.0,           -- R$ 2,00 taxa fixa
  insurance_percentage = 5,             -- Seguro 5% do valor
  swap_guarantee_fee_fixed = 5.0,       -- Taxa de garantia swap R$ 5,00
  default_shipping_from_cep = '01311100' -- CEP padrão São Paulo
WHERE id = 1;

-- ============================================================================
-- PASSO 6: CRIAR WEBHOOK URLS SUPABASE (para referência)
-- ============================================================================

-- Para Stripe, use esta URL no Dashboard Stripe → Developers → Webhooks:
-- https://seu-projeto.supabase.co/functions/v1/stripe-webhook

-- Para Mercado Pago, use (se implementado):
-- https://seu-projeto.supabase.co/functions/v1/mp-webhook

-- Para PayPal, use (se implementado):
-- https://seu-projeto.supabase.co/functions/v1/paypal-webhook

-- ============================================================================
-- PASSO 7: VERIFICAR CONFIGURAÇÃO FINAL
-- ============================================================================

SELECT 
  id,
  gateway_provider as "Gateway Ativo",
  gateway_mode as "Modo",
  sale_fee_pct as "Taxa Plataforma %",
  processing_fee_fixed as "Taxa Fixa R$",
  insurance_percentage as "Seguro %",
  CASE 
    WHEN gateway_provider = 'stripe' THEN 'Stripe configurado'
    WHEN gateway_provider = 'mercado_pago' THEN 'Mercado Pago configurado'
    WHEN gateway_provider = 'paypal' THEN 'PayPal configurado'
    ELSE 'Não configurado'
  END as "Status"
FROM platform_settings
WHERE id = 1;

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================
-- ⚠️ NUNCA committe chaves reais em Git
-- ⚠️ Use 'sandbox' para desenvolvimento, 'production' para produção real
-- ⚠️ As Edge Functions precisam estar deployadas:
--    - stripe-create-payment-intent
--    - mp-create-preference
--    - paypal-create-order
--    - paypal-capture-order
--    - process-transaction
-- 💡 Teste com cartões de teste do gateway escolhido
-- 🔒 Rotacione chaves periodicamente por segurança
-- ============================================================================

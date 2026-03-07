-- ============================================================================
-- ATIVAR PAGAMENTOS EM MODO PRODUÇÃO
-- ============================================================================
-- Execute este script para ativar os 3 gateways em modo PRODUÇÃO
-- Certifique-se de que as chaves já estão preenchidas em platform_settings
-- ============================================================================

-- PASSO 1: VERIFICAR SE AS CHAVES JÁ ESTÃO PREENCHIDAS
-- Execute esta consulta primeiro para confirmar
SELECT 
  gateway_provider,
  gateway_mode,
  -- STRIPE
  CASE WHEN stripe_publishable_key_production IS NOT NULL THEN '✅' ELSE '❌' END as "Stripe Pub",
  CASE WHEN stripe_secret_key_production IS NOT NULL THEN '✅' ELSE '❌' END as "Stripe Secret",
  CASE WHEN stripe_webhook_secret_production IS NOT NULL THEN '✅' ELSE '❌' END as "Stripe Webhook",
  -- MERCADO PAGO
  CASE WHEN mp_public_key_production IS NOT NULL THEN '✅' ELSE '❌' END as "MP Pub",
  CASE WHEN mp_access_token_production IS NOT NULL THEN '✅' ELSE '❌' END as "MP Token",
  -- PAYPAL
  CASE WHEN paypal_client_id_production IS NOT NULL THEN '✅' ELSE '❌' END as "PayPal ID",
  CASE WHEN paypal_client_secret_production IS NOT NULL THEN '✅' ELSE '❌' END as "PayPal Secret"
FROM platform_settings
WHERE id = 1;

-- ============================================================================
-- PASSO 2: ATIVAR STRIPE EM PRODUÇÃO
-- ============================================================================
-- Use esta opção se escolher Stripe como gateway principal

UPDATE platform_settings
SET 
  gateway_provider = 'stripe',
  gateway_mode = 'production',
  -- As chaves production já devem estar preenchidas
  -- se não estiverem, preencha manualmente no Supabase antes
  sale_fee_pct = 10,
  processing_fee_fixed = 2.0,
  insurance_percentage = 5,
  swap_guarantee_fee_fixed = 5.0,
  default_shipping_from_cep = '01311100'
WHERE id = 1;

-- ============================================================================
-- PASSO 3: ATIVAR MERCADO PAGO EM PRODUÇÃO
-- ============================================================================
-- Use esta opção se escolher Mercado Pago como gateway principal

UPDATE platform_settings
SET 
  gateway_provider = 'mercado_pago',
  gateway_mode = 'production',
  sale_fee_pct = 10,
  processing_fee_fixed = 2.0,
  insurance_percentage = 5,
  swap_guarantee_fee_fixed = 5.0,
  default_shipping_from_cep = '01311100'
WHERE id = 1;

-- ============================================================================
-- PASSO 4: ATIVAR PAYPAL EM PRODUÇÃO
-- ============================================================================
-- Use esta opção se escolher PayPal como gateway principal

UPDATE platform_settings
SET 
  gateway_provider = 'paypal',
  gateway_mode = 'production',
  sale_fee_pct = 10,
  processing_fee_fixed = 2.0,
  insurance_percentage = 5,
  swap_guarantee_fee_fixed = 5.0,
  default_shipping_from_cep = '01311100'
WHERE id = 1;

-- ============================================================================
-- PASSO 5: VERIFICAR CONFIGURAÇÃO FINAL
-- ============================================================================

SELECT 
  gateway_provider as "✨ Gateway Ativo",
  gateway_mode as "🔑 Modo",
  sale_fee_pct as "💰 Taxa Plataforma %",
  processing_fee_fixed as "📊 Taxa Fixa R$",
  insurance_percentage as "🛡️ Seguro %",
  swap_guarantee_fee_fixed as "🔄 Taxa Swap R$",
  CASE 
    WHEN gateway_provider = 'stripe' THEN '💳 Stripe Configurado'
    WHEN gateway_provider = 'mercado_pago' THEN '🎯 Mercado Pago Configurado'
    WHEN gateway_provider = 'paypal' THEN '🌐 PayPal Configurado'
  END as "Status"
FROM platform_settings
WHERE id = 1;

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================
-- ⚠️ Certifique-se de:
-- • As chaves de PRODUÇÃO estão preenchidas em todos os campos
-- • gateway_mode = 'production' está ativo
-- • As Edge Functions foram deployadas (ver instruções abaixo)
-- • Você está ciente que TRANSAÇÕES REAIS serão processadas
--
-- 🚀 Para Ativar:
-- 1. Escolha UM dos 3 gateways (PASSO 2, 3 ou 4)
-- 2. Execute apenas o PASSO correspondente
-- 3. As Edge Functions já devem estar deployadas
-- 4. Teste criando um anúncio com preço baixo
--
-- 💡 Dica: Stripe é mais rápido, Mercado Pago é mais barato
-- ============================================================================

-- ============================================================================
-- VERIFICAÇÃO SIMPLES - QUAIS CREDENCIAIS EXISTEM?
-- ============================================================================

SELECT 
  CASE WHEN stripe_publishable_key_production IS NOT NULL THEN '✅' ELSE '❌' END as "Stripe Pub",
  CASE WHEN stripe_secret_key_production IS NOT NULL THEN '✅' ELSE '❌' END as "Stripe Secret",
  CASE WHEN mp_public_key_production IS NOT NULL THEN '✅' ELSE '❌' END as "MP Public",
  CASE WHEN mp_access_token_production IS NOT NULL THEN '✅' ELSE '❌' END as "MP Token",
  CASE WHEN paypal_client_id_production IS NOT NULL THEN '✅' ELSE '❌' END as "PayPal ID",
  CASE WHEN paypal_client_secret_production IS NOT NULL THEN '✅' ELSE '❌' END as "PayPal Secret",
  gateway_mode as "Modo"
FROM platform_settings
WHERE id = 1;

-- Mostrar os primeiros caracteres das credenciais VÁLIDAS
SELECT '--- CREDENCIAIS CONFIGURADAS ---' as info UNION ALL
SELECT 'Stripe Pub: ' || COALESCE(LEFT(stripe_publishable_key_production, 15) || '...', '❌ FALTANDO') FROM platform_settings WHERE id = 1 UNION ALL
SELECT 'Stripe Secret: ' || COALESCE(LEFT(stripe_secret_key_production, 15) || '...', '❌ FALTANDO') FROM platform_settings WHERE id = 1 UNION ALL
SELECT 'MP Public: ' || COALESCE(LEFT(mp_public_key_production, 15) || '...', '❌ FALTANDO') FROM platform_settings WHERE id = 1 UNION ALL
SELECT 'MP Token: ' || COALESCE(LEFT(mp_access_token_production, 15) || '...', '❌ FALTANDO') FROM platform_settings WHERE id = 1 UNION ALL
SELECT 'PayPal ID: ' || COALESCE(LEFT(paypal_client_id_production, 15) || '...', '❌ FALTANDO') FROM platform_settings WHERE id = 1 UNION ALL
SELECT 'PayPal Secret: ' || COALESCE(LEFT(paypal_client_secret_production, 15) || '...', '❌ FALTANDO') FROM platform_settings WHERE id = 1;

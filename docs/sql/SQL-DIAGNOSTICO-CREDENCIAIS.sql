-- ============================================================================
-- DIAGNÓSTICO FINAL - VERIFICAR CREDENCIAIS REAIS
-- ============================================================================

SELECT 
  id,
  gateway_mode as "Modo",
  gateway_provider as "Provider",
  -- STRIPE
  SUBSTRING(stripe_publishable_key_production, 1, 20) || '...' as "Stripe Pub",
  CASE 
    WHEN stripe_publishable_key_production IS NOT NULL AND LENGTH(stripe_publishable_key_production) > 20
      AND stripe_publishable_key_production NOT LIKE '%FAKE%'
      AND stripe_publishable_key_production NOT LIKE '%test%'
    THEN '✅ VÁLIDA'
    ELSE '❌ Inválida/Fake'
  END as "Stripe OK?",
  
  -- MERCADO PAGO
  SUBSTRING(mp_public_key_production, 1, 20) || '...' as "MP Public",
  CASE 
    WHEN mp_public_key_production IS NOT NULL AND LENGTH(mp_public_key_production) > 20
      AND mp_public_key_production LIKE 'APP_USR%'
    THEN '✅ VÁLIDA'
    ELSE '❌ Inválida'
  END as "MP OK?",
  
  -- PAYPAL
  SUBSTRING(paypal_client_id_production, 1, 20) || '...' as "PayPal ID",
  CASE 
    WHEN paypal_client_id_production IS NOT NULL AND LENGTH(paypal_client_id_production) > 20
      AND paypal_client_id_production NOT LIKE '%FAKE%'
    THEN '✅ VÁLIDA'
    ELSE '❌ Inválida/Fake'
  END as "PayPal OK?"
FROM platform_settings
WHERE id = 1;

-- Ver se as chaves secretas também existem (usadas no backend)
SELECT 
  '=== RESUMO DE CREDENCIAIS ===' as info,
  CASE WHEN stripe_secret_key_production IS NOT NULL THEN '✅' ELSE '❌' END || ' Stripe Secret',
  CASE WHEN mp_access_token_production IS NOT NULL THEN '✅' ELSE '❌' END || ' MP Access Token',
  CASE WHEN paypal_client_secret_production IS NOT NULL THEN '✅' ELSE '❌' END || ' PayPal Secret'
FROM platform_settings
WHERE id = 1;

-- ============================================================================
-- TESTAR CONEXÃO COM A EDGE FUNCTION
-- ============================================================================
-- Este SQL apenas mostra informações sobre as Edge Functions

-- 1. Ver se as credenciais de produção existem E são válidas
SELECT 
  id,
  gateway_mode,
  gateway_provider,
  CASE 
    WHEN mp_access_token_production IS NOT NULL 
      AND LENGTH(mp_access_token_production) > 50
      AND mp_access_token_production LIKE 'APP_USR%'
    THEN '✅ Token válido para API'
    ELSE '❌ Token inválido'
  END as "MP Token Status"
FROM platform_settings
WHERE id = 1;

-- 2. Confirmar que estamos em PRODUCTION
SELECT 
  '⚠️ MODO OPERACIONAL' as alert,
  gateway_mode,
  'Deve estar em PRODUCTION' as esperado
FROM platform_settings
WHERE id = 1
  AND gateway_mode != 'production';

SELECT '✅ Modo correto (PRODUCTION)' as status
FROM platform_settings
WHERE id = 1
  AND gateway_mode = 'production';

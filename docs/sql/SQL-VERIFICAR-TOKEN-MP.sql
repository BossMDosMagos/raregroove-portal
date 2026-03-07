-- Verificar token do Mercado Pago
SELECT 
  LEFT(mp_access_token_production, 20) || '...' as token_inicio,
  LENGTH(mp_access_token_production) as token_length,
  gateway_mode
FROM platform_settings 
WHERE id = 1;

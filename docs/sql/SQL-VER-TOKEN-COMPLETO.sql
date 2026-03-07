-- Ver exatamente o token atual (primeiros e últimos caracteres)
SELECT 
  LEFT(mp_access_token_production, 30) as inicio,
  RIGHT(mp_access_token_production, 30) as fim,
  LENGTH(mp_access_token_production) as tamanho,
  gateway_mode
FROM platform_settings 
WHERE id = 1;

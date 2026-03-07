-- ============================================================================
-- DIAGNÓSTICO - VER O QUE TEM NO BANCO
-- ============================================================================

-- Ver todos os dados da tabela platform_settings
SELECT * FROM platform_settings WHERE id = 1;

-- Ver especificamente as colunas de gateway
SELECT 
  id,
  gateway_mode,
  gateway_provider,
  stripe_publishable_key_sandbox,
  stripe_secret_key_sandbox,
  mp_public_key_sandbox,
  mp_access_token_sandbox,
  paypal_client_id_sandbox,
  paypal_client_secret_sandbox
FROM platform_settings 
WHERE id = 1;

-- Verificar se a tabela está vazia
SELECT COUNT(*) as total_registros FROM platform_settings;

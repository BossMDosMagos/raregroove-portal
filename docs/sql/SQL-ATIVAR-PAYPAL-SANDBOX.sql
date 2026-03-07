-- ============================================================
-- ATIVAR PAYPAL (SANDBOX) PARA TESTES NO CHECKOUT
-- ============================================================

-- 1) Ver estado atual
SELECT
  id,
  gateway_mode,
  gateway_provider,
  CASE WHEN COALESCE(paypal_client_id_sandbox, '') <> '' THEN 'OK' ELSE 'FALTANDO' END AS paypal_client_id_sandbox,
  CASE WHEN COALESCE(paypal_client_secret_sandbox, '') <> '' THEN 'OK' ELSE 'FALTANDO' END AS paypal_client_secret_sandbox
FROM platform_settings
WHERE id = 1;

-- 2) Ativar PayPal em sandbox (mantém suas credenciais já salvas)
UPDATE platform_settings
SET
  gateway_mode = 'sandbox',
  gateway_provider = 'paypal',
  updated_at = NOW()
WHERE id = 1;

-- 3) Confirmar ativação
SELECT
  id,
  gateway_mode,
  gateway_provider,
  CASE WHEN COALESCE(paypal_client_id_sandbox, '') <> '' THEN 'OK' ELSE 'FALTANDO' END AS paypal_client_id_sandbox,
  CASE WHEN COALESCE(paypal_client_secret_sandbox, '') <> '' THEN 'OK' ELSE 'FALTANDO' END AS paypal_client_secret_sandbox,
  updated_at
FROM platform_settings
WHERE id = 1;

SELECT '✅ PayPal sandbox ativado para teste.' AS status;

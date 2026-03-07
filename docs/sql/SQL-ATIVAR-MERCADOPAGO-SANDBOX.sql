-- ============================================================
-- ATIVAR MERCADO PAGO (SANDBOX) PARA TESTES NO CHECKOUT
-- ============================================================

-- 1) Ver estado atual
SELECT
  id,
  gateway_mode,
  gateway_provider,
  CASE WHEN COALESCE(mp_public_key_sandbox, '') <> '' THEN 'OK' ELSE 'FALTANDO' END AS mp_public_key_sandbox,
  CASE WHEN COALESCE(mp_access_token_sandbox, '') <> '' THEN 'OK' ELSE 'FALTANDO' END AS mp_access_token_sandbox
FROM platform_settings
WHERE id = 1;

-- 2) Ativar Mercado Pago em sandbox (mantém suas credenciais já salvas)
UPDATE platform_settings
SET
  gateway_mode = 'sandbox',
  gateway_provider = 'mercado_pago',
  updated_at = NOW()
WHERE id = 1;

-- 3) Confirmar ativação
SELECT
  id,
  gateway_mode,
  gateway_provider,
  CASE WHEN COALESCE(mp_public_key_sandbox, '') <> '' THEN 'OK' ELSE 'FALTANDO' END AS mp_public_key_sandbox,
  CASE WHEN COALESCE(mp_access_token_sandbox, '') <> '' THEN 'OK' ELSE 'FALTANDO' END AS mp_access_token_sandbox,
  updated_at
FROM platform_settings
WHERE id = 1;

SELECT '✅ Mercado Pago sandbox ativado para teste.' AS status;

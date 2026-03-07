-- =====================================================================
-- SALVAR STRIPE WEBHOOK SECRET NO SUPABASE
-- =====================================================================
-- Execute este comando no Supabase SQL Editor para registrar a chave webhook

-- Verificar se tabela platform_settings existe
SELECT * FROM platform_settings LIMIT 1;

-- Salvar a chave webhook (SANDBOX - para testes)
UPDATE platform_settings
SET stripe_webhook_secret_sandbox = 'whsec_617c80405e81c1e3b96d54d67c9b7c4e85923a9ea9bfad8bd14a6762759fc8a1'
WHERE id = 1;

-- Verificar se foi salvo corretamente
SELECT 
  id,
  stripe_webhook_secret_sandbox,
  updated_at
FROM platform_settings
WHERE id = 1;

SELECT '✅ STRIPE WEBHOOK REGISTRADO COM SUCESSO!' AS status;

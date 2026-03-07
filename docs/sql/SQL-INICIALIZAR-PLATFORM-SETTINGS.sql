-- ============================================================================
-- INICIALIZAR PLATFORM_SETTINGS
-- ============================================================================
-- Execute este script para garantir que existe um registro inicial
-- Este script é seguro e não apaga dados existentes

-- PASSO 1: Verificar se já existe registro
SELECT * FROM platform_settings WHERE id = 1;

-- PASSO 2: Se não existir, criar um registro inicial com padrões
INSERT INTO platform_settings (
  id,
  gateway_mode,
  gateway_provider,
  sale_fee_pct,
  processing_fee_fixed,
  insurance_percentage,
  swap_guarantee_fee_fixed,
  default_shipping_from_cep,
  created_at,
  updated_at
)
VALUES (
  1,
  'sandbox',  -- Início em sandbox para testes
  'stripe',   -- Gateway padrão
  10,         -- 10% taxa de venda
  2.0,        -- R$ 2.00 taxa fixa de processamento
  5,          -- 5% seguro
  5.0,        -- R$ 5.00 taxa de garantia swap
  '01311100', -- São Paulo como CEP padrão de envio
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- PASSO 3: Verificar o resultado
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

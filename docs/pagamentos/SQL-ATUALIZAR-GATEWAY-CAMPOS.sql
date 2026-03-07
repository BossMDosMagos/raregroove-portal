-- =============================================================================
-- ATUALIZAR CAMPOS DE GATEWAY - PLATFORM SETTINGS
-- Data: 25/02/2026
-- =============================================================================
-- Adicionar colunas específicas para cada gateway de pagamento
-- Atualizar tipos decimais para suportar valores como 6,5%
-- =============================================================================

DO $$
BEGIN
  -- =============================================================================
  -- 1) ATUALIZAR TIPOS DE TAXAS PARA SUPORTAR DECIMAIS (ex: 6.5%)
  -- =============================================================================
  
  -- Alterar sale_fee_pct para suportar até 999.99%
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'platform_settings' 
             AND column_name = 'sale_fee_pct') THEN
    ALTER TABLE public.platform_settings 
      ALTER COLUMN sale_fee_pct TYPE NUMERIC(6, 2);
    RAISE NOTICE '✓ sale_fee_pct atualizado para NUMERIC(6,2)';
  END IF;

  -- Alterar swap_guarantee_portal_pct para suportar até 999.99%
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'platform_settings' 
             AND column_name = 'swap_guarantee_portal_pct') THEN
    ALTER TABLE public.platform_settings 
      ALTER COLUMN swap_guarantee_portal_pct TYPE NUMERIC(6, 2);
    RAISE NOTICE '✓ swap_guarantee_portal_pct atualizado para NUMERIC(6,2)';
  END IF;

  -- =============================================================================
  -- 2) ADICIONAR COLUNAS PARA MERCADO PAGO
  -- =============================================================================
  
  ALTER TABLE public.platform_settings
    ADD COLUMN IF NOT EXISTS mp_public_key_sandbox TEXT,
    ADD COLUMN IF NOT EXISTS mp_access_token_sandbox TEXT,
    ADD COLUMN IF NOT EXISTS mp_public_key_production TEXT,
    ADD COLUMN IF NOT EXISTS mp_access_token_production TEXT;
  
  RAISE NOTICE '✓ Colunas Mercado Pago verificadas/criadas';

  -- =============================================================================
  -- 3) ADICIONAR COLUNAS PARA STRIPE
  -- =============================================================================
  
  ALTER TABLE public.platform_settings
    ADD COLUMN IF NOT EXISTS stripe_publishable_key_sandbox TEXT,
    ADD COLUMN IF NOT EXISTS stripe_secret_key_sandbox TEXT,
    ADD COLUMN IF NOT EXISTS stripe_webhook_secret_sandbox TEXT,
    ADD COLUMN IF NOT EXISTS stripe_publishable_key_production TEXT,
    ADD COLUMN IF NOT EXISTS stripe_secret_key_production TEXT,
    ADD COLUMN IF NOT EXISTS stripe_webhook_secret_production TEXT;
  
  RAISE NOTICE '✓ Colunas Stripe verificadas/criadas';

  -- =============================================================================
  -- 4) ADICIONAR COLUNAS PARA PAYPAL
  -- =============================================================================
  
  ALTER TABLE public.platform_settings
    ADD COLUMN IF NOT EXISTS paypal_client_id_sandbox TEXT,
    ADD COLUMN IF NOT EXISTS paypal_client_secret_sandbox TEXT,
    ADD COLUMN IF NOT EXISTS paypal_client_id_production TEXT,
    ADD COLUMN IF NOT EXISTS paypal_client_secret_production TEXT;
  
  RAISE NOTICE '✓ Colunas PayPal verificadas/criadas';

  -- =============================================================================
  -- 5) RELATORIO FINAL
  -- =============================================================================
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  GATEWAY CAMPOS ATUALIZADOS';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Tipos decimais atualizados (suporta 6.5%%)';
  RAISE NOTICE '✅ Mercado Pago: 4 colunas';
  RAISE NOTICE '✅ Stripe: 6 colunas';
  RAISE NOTICE '✅ PayPal: 4 colunas';
  RAISE NOTICE '========================================';
  
END $$;

-- Verificar estrutura final
SELECT 
  column_name, 
  data_type, 
  character_maximum_length,
  numeric_precision,
  numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'platform_settings'
  AND (column_name LIKE '%gateway%' 
       OR column_name LIKE 'mp_%'
       OR column_name LIKE 'stripe_%'
       OR column_name LIKE 'paypal_%'
       OR column_name LIKE '%fee%')
ORDER BY column_name;

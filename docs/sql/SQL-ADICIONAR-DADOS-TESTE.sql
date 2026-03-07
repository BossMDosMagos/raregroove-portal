-- Adicionar colunas de dados de teste à tabela platform_settings
-- Comprador
ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS test_buyer_country VARCHAR(100) DEFAULT 'Brasil';

ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS test_buyer_user_id VARCHAR(100) DEFAULT '3239678586';

ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS test_buyer_username VARCHAR(100) DEFAULT 'TESTUSER4209988089763575370';

ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS test_buyer_password VARCHAR(100) DEFAULT 'eVTrQ5m7Jf';

ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS test_buyer_verification_code VARCHAR(100) DEFAULT '678586';

-- Vendedor
ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS test_seller_country VARCHAR(100) DEFAULT 'Brasil';

ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS test_seller_user_id VARCHAR(100) DEFAULT '3239678584';

ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS test_seller_username VARCHAR(100) DEFAULT 'TESTUSER396528322220256871';

ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS test_seller_password VARCHAR(100) DEFAULT '9ALpMREwSU';

ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS test_seller_verification_code VARCHAR(100) DEFAULT '678584';

-- Update RLS policy para permitir admin ler/atualizar esses campos
-- (Se houver uma policy específica, você pode aplicá-la aqui)

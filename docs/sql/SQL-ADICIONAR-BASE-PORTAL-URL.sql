-- =====================================================================
-- FIX: Adicionar coluna base_portal_url à tabela platform_settings
-- =====================================================================
-- Este script adiciona a coluna faltante que permite configurar a URL
-- do portal para geração de QR codes nas etiquetas de envio.
-- Executar direto no console do Supabase ou na aba SQL.

ALTER TABLE public.platform_settings
ADD COLUMN IF NOT EXISTS base_portal_url TEXT DEFAULT 'https://raregroove.com';

-- Verificar se a coluna foi criada
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'platform_settings' AND column_name = 'base_portal_url';

-- Script alternativo (se o anterior não funcionar):
-- BEGIN;
--   DO $$
--   BEGIN
--     IF NOT EXISTS (
--       SELECT 1 FROM information_schema.columns 
--       WHERE table_name = 'platform_settings' AND column_name = 'base_portal_url'
--     ) THEN
--       ALTER TABLE public.platform_settings
--       ADD COLUMN base_portal_url TEXT DEFAULT 'https://raregroove.com';
--     END IF;
--   END $$;
-- COMMIT;

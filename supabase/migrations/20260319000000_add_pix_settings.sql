-- Adicionar colunas de PIX ao platform_settings
ALTER TABLE public.platform_settings 
ADD COLUMN IF NOT EXISTS pix_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pix_key TEXT,
ADD COLUMN IF NOT EXISTS pix_beneficiary TEXT;
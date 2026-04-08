-- ============================================
-- BARCODE MIGRATION - Execute no Supabase SQL Editor
-- Dashboard: https://supabase.com/dashboard/project/hlfirfukbrisfpebaaur/sql
-- ============================================

-- Adicionar coluna barcode
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'barcode') THEN
    ALTER TABLE public.items ADD COLUMN barcode text;
    COMMENT ON COLUMN public.items.barcode IS 'Código de barras/UPC do item para verificação de autenticidade no Discogs';
  END IF;
END $$;

-- Criar índice para busca por barcode
CREATE INDEX IF NOT EXISTS idx_items_barcode ON public.items(barcode);

-- Verificar resultado
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'items' AND column_name = 'barcode';

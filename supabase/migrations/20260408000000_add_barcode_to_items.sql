-- Adicionar coluna barcode para rastreamento de autenticidade
-- Execute: supabase db push ou psql

BEGIN;

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

-- Adicionar barcode ao metadata JSONB para itens grooveflix
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'metadata' AND column_default IS NULL) THEN
    -- metadata já existe, apenas garantir que barcode pode ser acessado via JSONB
    -- Isso é apenas para documentação - metadata é JSONB então aceita qualquer campo
    RAISE NOTICE 'metadata column exists as JSONB, barcode will be stored there too';
  END IF;
END $$;

COMMIT;

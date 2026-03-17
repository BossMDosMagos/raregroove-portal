-- Adicionar coluna year à tabela items (se não existir)
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS year text;

COMMENT ON COLUMN public.items.year IS 'Ano de lançamento do item';

-- Garantir que genre existe (caso a migration anterior não tenha funcionado)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'items' AND column_name = 'genre'
    ) THEN
        ALTER TABLE public.items ADD COLUMN genre text;
    END IF;
END $$;

-- Recarregar cache do PostgREST
NOTIFY pgrst, 'reload schema';

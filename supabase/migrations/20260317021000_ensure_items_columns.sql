-- Adicionar colunas faltantes para o catálogo de CDs
-- Execute: supabase db push ou psql

BEGIN;

-- Verificar e adicionar colunas uma por uma (IF NOT EXISTS não funciona para ADD COLUMN)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'genre') THEN
    ALTER TABLE public.items ADD COLUMN genre text;
    COMMENT ON COLUMN public.items.genre IS 'Gênero musical do item (Jazz, Funk, Soul, etc.)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'year') THEN
    ALTER TABLE public.items ADD COLUMN year integer;
    COMMENT ON COLUMN public.items.year IS 'Ano de lançamento do item';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'artist') THEN
    ALTER TABLE public.items ADD COLUMN artist text;
    COMMENT ON COLUMN public.items.artist IS 'Nome do artista/banda';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'album_name') THEN
    ALTER TABLE public.items ADD COLUMN album_name text;
    COMMENT ON COLUMN public.items.album_name IS 'Nome do álbum';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'cover_url') THEN
    ALTER TABLE public.items ADD COLUMN cover_url text;
    COMMENT ON COLUMN public.items.cover_url IS 'URL da capa do álbum (para usar no lugar de image_url quando disponível)';
  END IF;
END $$;

-- Criar índices para performance dos filtros
CREATE INDEX IF NOT EXISTS idx_items_genre ON public.items(genre);
CREATE INDEX IF NOT EXISTS idx_items_year ON public.items(year);
CREATE INDEX IF NOT EXISTS idx_items_artist ON public.items(artist);

COMMIT;

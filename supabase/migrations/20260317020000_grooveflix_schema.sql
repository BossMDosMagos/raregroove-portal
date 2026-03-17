-- Schema para Grooveflix - Plataforma de Streaming Pessoal
-- Colunas essenciais para catálogo de mídia

BEGIN;

-- Verificar e adicionar colunas uma por uma
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'artist') THEN
    ALTER TABLE public.items ADD COLUMN artist text;
    COMMENT ON COLUMN public.items.artist IS 'Nome do artista/banda';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'genre') THEN
    ALTER TABLE public.items ADD COLUMN genre text;
    COMMENT ON COLUMN public.items.genre IS 'Gênero musical (Jazz, Funk, Soul, etc.)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'year') THEN
    ALTER TABLE public.items ADD COLUMN year integer;
    COMMENT ON COLUMN public.items.year IS 'Ano de lançamento';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'file_url') THEN
    ALTER TABLE public.items ADD COLUMN file_url text;
    COMMENT ON COLUMN public.items.file_url IS 'URL do arquivo de mídia (áudio/vídeo)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'duration_seconds') THEN
    ALTER TABLE public.items ADD COLUMN duration_seconds integer;
    COMMENT ON COLUMN public.items.duration_seconds IS 'Duração em segundos';
  END IF;
END $$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_items_artist ON public.items(artist);
CREATE INDEX IF NOT EXISTS idx_items_genre ON public.items(genre);
CREATE INDEX IF NOT EXISTS idx_items_year ON public.items(year);

COMMIT;

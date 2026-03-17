-- Adicionar coluna genre à tabela items
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS genre text;

COMMENT ON COLUMN public.items.genre IS 'Gênero musical do item (Jazz, Funk, Soul, etc.)';

-- Adicionar status pendente para itens
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_status_check;
ALTER TABLE public.items ADD CONSTRAINT items_status_check CHECK (
  status IN ('disponivel', 'reservado', 'pendente', 'vendido')
);
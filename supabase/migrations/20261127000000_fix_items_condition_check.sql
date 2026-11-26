-- A escala pública do Discogs possui 6 níveis (M, NM, VG+, VG, G e F),
-- mas o constraint antigo só aceitava os 4 primeiros, fazendo o cadastro
-- falhar com erro 23514 ao selecionar Good (G) ou Fair (F).
ALTER TABLE public.items
  DROP CONSTRAINT IF EXISTS items_condition_check;

ALTER TABLE public.items
  ADD CONSTRAINT items_condition_check
  CHECK (condition IN ('MINT', 'NM', 'VG+', 'VG', 'G', 'F'));

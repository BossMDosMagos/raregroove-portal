-- Adicionar coluna para armazenar a URL do comprovante PIX enviado pelo comprador,
-- permitindo que o vendedor confira o recibo antes de aprovar a venda.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS comprovante_url TEXT;

-- Tabela de faixas de frete interna (estimativa por CEP de destino).
-- Usada pelo checkout para calcular e embutir o frete no valor pago.
CREATE TABLE IF NOT EXISTS public.shipping_rates (
  id BIGSERIAL PRIMARY KEY,
  cep_start TEXT NOT NULL,
  cep_end TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  estimated_days INTEGER NOT NULL DEFAULT 7,
  max_weight_kg NUMERIC(10,2) NOT NULL DEFAULT 2,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipping_rates_public_read" ON public.shipping_rates;
CREATE POLICY "shipping_rates_public_read"
  ON public.shipping_rates FOR SELECT
  USING (active = TRUE);

-- Faixas padrão por primeiro dígito do CEP (aproximação regional).
INSERT INTO public.shipping_rates (cep_start, cep_end, price, estimated_days, max_weight_kg)
VALUES
  ('00000000', '19999999', 18.00, 9, 2),
  ('20000000', '39999999', 22.00, 7, 2),
  ('40000000', '59999999', 25.00, 5, 2),
  ('60000000', '79999999', 28.00, 4, 2),
  ('80000000', '99999999', 32.00, 3, 2)
ON CONFLICT DO NOTHING;

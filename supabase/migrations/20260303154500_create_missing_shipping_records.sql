-- Criar registros de shipping para transações sem shipping

-- Inserir shipping para todas transações que não têm shipping_id
INSERT INTO public.shipping (
  transaction_id,
  buyer_id,
  seller_id,
  item_id,
  from_cep,
  from_address,
  to_cep,
  to_address,
  estimated_cost,
  has_insurance,
  insurance_cost,
  carrier,
  status
)
SELECT
  t.id AS transaction_id,
  t.buyer_id,
  COALESCE(t.seller_id, (SELECT id FROM auth.users LIMIT 1)) AS seller_id, -- fallback para portal
  t.item_id,
  '00000-000' AS from_cep, -- placeholder
  '{}'::jsonb AS from_address,
  '00000-000' AS to_cep, -- placeholder
  '{}'::jsonb AS to_address,
  COALESCE(t.shipping_cost, 0) AS estimated_cost,
  COALESCE(t.insurance_cost, 0) > 0 AS has_insurance,
  COALESCE(t.insurance_cost, 0) AS insurance_cost,
  'correios' AS carrier,
  'awaiting_label' AS status
FROM public.transactions t
WHERE t.shipping_id IS NULL
  AND t.status IN ('pago_em_custodia', 'pago', 'enviado', 'concluido')
ON CONFLICT DO NOTHING;

-- Atualizar transactions com o shipping_id criado
UPDATE public.transactions t
SET shipping_id = s.shipping_id
FROM public.shipping s
WHERE t.id = s.transaction_id
  AND t.shipping_id IS NULL;

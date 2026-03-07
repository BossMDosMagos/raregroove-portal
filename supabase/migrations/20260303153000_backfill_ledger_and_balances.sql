-- Backfill financeiro: reconcilia ledger e saldos pendentes com transações já criadas

-- 1) Garantir lançamento do vendedor (venda_realizada) para marketplace
INSERT INTO public.financial_ledger (
  source_type,
  source_id,
  entry_type,
  amount,
  user_id,
  metadata
)
SELECT
  'venda' AS source_type,
  t.id AS source_id,
  'venda_realizada' AS entry_type,
  COALESCE(t.net_amount, 0) AS amount,
  t.seller_id AS user_id,
  jsonb_build_object(
    'item_id', t.item_id,
    'buyer_id', t.buyer_id,
    'platform_fee', COALESCE(t.platform_fee, 0),
    'gateway_fee', COALESCE(t.gateway_fee, 0),
    'payment_id', t.payment_id,
    'backfill', true
  ) AS metadata
FROM public.transactions t
WHERE t.seller_id IS NOT NULL
  AND t.transaction_type IN ('venda')
  AND t.status IN ('pago_em_custodia', 'pago', 'enviado', 'concluido')
  AND NOT EXISTS (
    SELECT 1
    FROM public.financial_ledger fl
    WHERE fl.source_id = t.id
      AND fl.entry_type = 'venda_realizada'
  );

-- 2) Garantir lançamento da taxa do portal (taxa_plataforma) para marketplace
INSERT INTO public.financial_ledger (
  source_type,
  source_id,
  entry_type,
  amount,
  user_id,
  metadata
)
SELECT
  'venda' AS source_type,
  t.id AS source_id,
  'taxa_plataforma' AS entry_type,
  COALESCE(t.platform_fee, 0) AS amount,
  NULL::uuid AS user_id,
  jsonb_build_object(
    'item_id', t.item_id,
    'buyer_id', t.buyer_id,
    'seller_id', t.seller_id,
    'payment_id', t.payment_id,
    'description', 'Taxa de intermediação marketplace (backfill)',
    'backfill', true
  ) AS metadata
FROM public.transactions t
WHERE t.seller_id IS NOT NULL
  AND t.transaction_type IN ('venda')
  AND t.status IN ('pago_em_custodia', 'pago', 'enviado', 'concluido')
  AND NOT EXISTS (
    SELECT 1
    FROM public.financial_ledger fl
    WHERE fl.source_id = t.id
      AND fl.entry_type = 'taxa_plataforma'
  );

-- 3) Garantir receita portal para vendas próprias
INSERT INTO public.financial_ledger (
  source_type,
  source_id,
  entry_type,
  amount,
  user_id,
  metadata
)
SELECT
  'venda_portal' AS source_type,
  t.id AS source_id,
  'receita_portal' AS entry_type,
  COALESCE(t.total_amount, 0) AS amount,
  NULL::uuid AS user_id,
  jsonb_build_object(
    'item_id', t.item_id,
    'buyer_id', t.buyer_id,
    'total_amount', COALESCE(t.total_amount, 0),
    'payment_id', t.payment_id,
    'description', 'Venda direta do portal - backfill',
    'backfill', true
  ) AS metadata
FROM public.transactions t
WHERE (t.seller_id IS NULL OR t.transaction_type = 'venda_portal')
  AND t.status IN ('pago_em_custodia', 'pago', 'enviado', 'concluido')
  AND NOT EXISTS (
    SELECT 1
    FROM public.financial_ledger fl
    WHERE fl.source_id = t.id
      AND fl.entry_type = 'receita_portal'
  );

-- 4) Recalcular pending_balance dos vendedores com base no estado atual das transações
UPDATE public.user_balances ub
SET pending_balance = COALESCE(calc.pending_total, 0),
    updated_at = now()
FROM (
  SELECT
    t.seller_id,
    SUM(COALESCE(t.net_amount, 0)) AS pending_total
  FROM public.transactions t
  WHERE t.seller_id IS NOT NULL
    AND t.status IN ('pago_em_custodia', 'pago', 'enviado')
  GROUP BY t.seller_id
) calc
WHERE ub.user_id = calc.seller_id;

-- 5) Para vendedores sem transação pendente, zera pending_balance
UPDATE public.user_balances ub
SET pending_balance = 0,
    updated_at = now()
WHERE NOT EXISTS (
  SELECT 1
  FROM public.transactions t
  WHERE t.seller_id = ub.user_id
    AND t.status IN ('pago_em_custodia', 'pago', 'enviado')
);

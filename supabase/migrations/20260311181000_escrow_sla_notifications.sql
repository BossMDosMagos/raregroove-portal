CREATE OR REPLACE FUNCTION public.run_escrow_sla()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ship_overdue int := 0;
  v_delivery_overdue int := 0;
  v_auto_disputes int := 0;
BEGIN
  WITH overdue AS (
    SELECT t.id AS transaction_id, t.seller_id, t.buyer_id, t.item_id, i.title AS item_title
    FROM public.transactions t
    LEFT JOIN public.items i ON i.id = t.item_id
    WHERE t.transaction_type = 'venda'
      AND t.seller_id IS NOT NULL
      AND t.status IN ('pago_em_custodia', 'pago')
      AND t.shipped_at IS NULL
      AND t.created_at <= now() - interval '2 days'
  ),
  inserted AS (
    INSERT INTO public.escrow_sla_events (transaction_id, event_type, metadata)
    SELECT o.transaction_id, 'ship_overdue_2d', jsonb_build_object('threshold_days', 2)
    FROM overdue o
    ON CONFLICT DO NOTHING
    RETURNING transaction_id
  ),
  notify AS (
    INSERT INTO public.notifications (user_id, type, title, message, item_id, related_id, dedupe_key, is_read, created_at)
    SELECT
      o.seller_id,
      'transaction',
      'ENVIO ATRASADO (2 DIAS)',
      COALESCE('Você precisa postar o item: ' || COALESCE(o.item_title, 'Item') || '.', 'Você precisa postar o item.'),
      o.item_id,
      NULL,
      'escrow_sla:ship_overdue_2d:' || o.transaction_id::text,
      false,
      now()
    FROM overdue o
    WHERE o.seller_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM inserted i WHERE i.transaction_id = o.transaction_id)
    ON CONFLICT (user_id, dedupe_key) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_ship_overdue FROM inserted;

  WITH overdue_delivery AS (
    SELECT t.id AS transaction_id, t.seller_id, t.buyer_id, t.item_id, i.title AS item_title
    FROM public.transactions t
    LEFT JOIN public.items i ON i.id = t.item_id
    WHERE t.transaction_type = 'venda'
      AND t.status = 'enviado'
      AND t.shipped_at IS NOT NULL
      AND t.shipped_at <= now() - interval '14 days'
  ),
  inserted AS (
    INSERT INTO public.escrow_sla_events (transaction_id, event_type, metadata)
    SELECT o.transaction_id, 'delivery_overdue_14d', jsonb_build_object('threshold_days', 14)
    FROM overdue_delivery o
    ON CONFLICT DO NOTHING
    RETURNING transaction_id
  ),
  seller_notify AS (
    INSERT INTO public.notifications (user_id, type, title, message, item_id, related_id, dedupe_key, is_read, created_at)
    SELECT
      o.seller_id,
      'transaction',
      'ENTREGA ATRASADA (14 DIAS)',
      COALESCE('A entrega pode estar atrasada: ' || COALESCE(o.item_title, 'Item') || '.', 'A entrega pode estar atrasada.'),
      o.item_id,
      NULL,
      'escrow_sla:delivery_overdue_14d:seller:' || o.transaction_id::text,
      false,
      now()
    FROM overdue_delivery o
    WHERE o.seller_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM inserted i WHERE i.transaction_id = o.transaction_id)
    ON CONFLICT (user_id, dedupe_key) DO NOTHING
    RETURNING 1
  ),
  buyer_notify AS (
    INSERT INTO public.notifications (user_id, type, title, message, item_id, related_id, dedupe_key, is_read, created_at)
    SELECT
      o.buyer_id,
      'transaction',
      'ENTREGA ATRASADA (14 DIAS)',
      COALESCE('Se você não recebeu: ' || COALESCE(o.item_title, 'Item') || ', abra uma disputa.', 'Se você não recebeu, abra uma disputa.'),
      o.item_id,
      NULL,
      'escrow_sla:delivery_overdue_14d:buyer:' || o.transaction_id::text,
      false,
      now()
    FROM overdue_delivery o
    WHERE o.buyer_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM inserted i WHERE i.transaction_id = o.transaction_id)
    ON CONFLICT (user_id, dedupe_key) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_delivery_overdue FROM inserted;

  WITH eligible AS (
    SELECT t.id AS transaction_id, t.seller_id, t.buyer_id, t.item_id, i.title AS item_title
    FROM public.transactions t
    LEFT JOIN public.items i ON i.id = t.item_id
    WHERE t.transaction_type = 'venda'
      AND t.status = 'enviado'
      AND t.shipped_at IS NOT NULL
      AND t.shipped_at <= now() - interval '30 days'
      AND NOT EXISTS (
        SELECT 1
        FROM public.disputes d
        WHERE d.transaction_id = t.id
          AND d.status IN ('open', 'awaiting_seller', 'awaiting_buyer', 'under_review')
      )
  ),
  created AS (
    SELECT
      e.transaction_id,
      e.seller_id,
      e.buyer_id,
      e.item_id,
      e.item_title,
      public.system_create_dispute(e.transaction_id, 'Não entregue em 30 dias (abertura automática)', 'under_review') AS dispute_id
    FROM eligible e
  ),
  inserted AS (
    INSERT INTO public.escrow_sla_events (transaction_id, event_type, metadata)
    SELECT c.transaction_id, 'auto_dispute_30d', jsonb_build_object('threshold_days', 30, 'dispute_id', c.dispute_id)
    FROM created c
    ON CONFLICT DO NOTHING
    RETURNING transaction_id
  ),
  seller_notify AS (
    INSERT INTO public.notifications (user_id, type, title, message, item_id, related_id, dedupe_key, is_read, created_at)
    SELECT
      c.seller_id,
      'system',
      'DISPUTA ABERTA AUTOMATICAMENTE',
      COALESCE('Uma disputa foi aberta por atraso de entrega: ' || COALESCE(c.item_title, 'Item') || '.', 'Uma disputa foi aberta por atraso de entrega.'),
      c.item_id,
      c.dispute_id,
      'escrow_sla:auto_dispute_30d:seller:' || c.transaction_id::text,
      false,
      now()
    FROM created c
    WHERE c.seller_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM inserted i WHERE i.transaction_id = c.transaction_id)
    ON CONFLICT (user_id, dedupe_key) DO NOTHING
    RETURNING 1
  ),
  buyer_notify AS (
    INSERT INTO public.notifications (user_id, type, title, message, item_id, related_id, dedupe_key, is_read, created_at)
    SELECT
      c.buyer_id,
      'system',
      'DISPUTA ABERTA AUTOMATICAMENTE',
      COALESCE('Abrimos uma disputa automática por atraso de entrega: ' || COALESCE(c.item_title, 'Item') || '.', 'Abrimos uma disputa automática por atraso de entrega.'),
      c.item_id,
      c.dispute_id,
      'escrow_sla:auto_dispute_30d:buyer:' || c.transaction_id::text,
      false,
      now()
    FROM created c
    WHERE c.buyer_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM inserted i WHERE i.transaction_id = c.transaction_id)
    ON CONFLICT (user_id, dedupe_key) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_auto_disputes FROM inserted;

  RETURN jsonb_build_object(
    'ship_overdue_2d_notified', v_ship_overdue,
    'delivery_overdue_14d_notified', v_delivery_overdue,
    'auto_dispute_30d_notified', v_auto_disputes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_escrow_sla() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_escrow_sla() TO service_role;

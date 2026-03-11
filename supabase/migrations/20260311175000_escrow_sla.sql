-- Escrow SLA automation (timers / auto-dispute) - MVP

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'escrow_sla_events'
  ) THEN
    CREATE TABLE public.escrow_sla_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
      event_type text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE UNIQUE INDEX escrow_sla_events_unique ON public.escrow_sla_events(transaction_id, event_type);
    CREATE INDEX escrow_sla_events_created_at_idx ON public.escrow_sla_events(created_at);
  END IF;
END $$;

ALTER TABLE public.escrow_sla_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Escrow SLA events admin read" ON public.escrow_sla_events;
CREATE POLICY "Escrow SLA events admin read"
ON public.escrow_sla_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
);

DROP POLICY IF EXISTS "Escrow SLA events deny insert" ON public.escrow_sla_events;
CREATE POLICY "Escrow SLA events deny insert"
ON public.escrow_sla_events
FOR INSERT
WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.system_create_dispute(p_transaction_id uuid, p_reason text, p_status text DEFAULT 'under_review')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx record;
  v_existing uuid;
  v_id uuid;
  v_reason text := NULLIF(trim(coalesce(p_reason, '')), '');
  v_status text := NULLIF(trim(coalesce(p_status, '')), '');
BEGIN
  IF v_reason IS NULL THEN
    v_reason := 'Disputa aberta automaticamente';
  END IF;
  IF v_status IS NULL THEN
    v_status := 'under_review';
  END IF;

  SELECT id, buyer_id, seller_id, status
  INTO v_tx
  FROM public.transactions
  WHERE id = p_transaction_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT d.id
  INTO v_existing
  FROM public.disputes d
  WHERE d.transaction_id = p_transaction_id
    AND d.status IN ('open', 'awaiting_seller', 'awaiting_buyer', 'under_review')
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.disputes (transaction_id, opened_by, buyer_id, seller_id, status, reason, created_at, updated_at, metadata)
  VALUES (
    p_transaction_id,
    v_tx.buyer_id,
    v_tx.buyer_id,
    v_tx.seller_id,
    v_status,
    v_reason,
    now(),
    now(),
    jsonb_build_object('auto', true, 'auto_reason', v_reason)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.system_create_dispute(uuid, text, text) FROM PUBLIC;

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
  v_tx_id uuid;
BEGIN
  -- 1) Vendedor não enviou em até 2 dias após pagamento (custódia)
  WITH overdue AS (
    SELECT t.id
    FROM public.transactions t
    WHERE t.transaction_type = 'venda'
      AND t.seller_id IS NOT NULL
      AND t.status IN ('pago_em_custodia', 'pago')
      AND t.shipped_at IS NULL
      AND t.created_at <= now() - interval '2 days'
  )
  INSERT INTO public.escrow_sla_events (transaction_id, event_type, metadata)
  SELECT o.id, 'ship_overdue_2d', jsonb_build_object('threshold_days', 2)
  FROM overdue o
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_ship_overdue = ROW_COUNT;

  -- 2) Entrega potencialmente atrasada (14 dias após envio) - apenas sinalização
  WITH overdue_delivery AS (
    SELECT t.id
    FROM public.transactions t
    WHERE t.transaction_type = 'venda'
      AND t.status = 'enviado'
      AND t.shipped_at IS NOT NULL
      AND t.shipped_at <= now() - interval '14 days'
  )
  INSERT INTO public.escrow_sla_events (transaction_id, event_type, metadata)
  SELECT o.id, 'delivery_overdue_14d', jsonb_build_object('threshold_days', 14)
  FROM overdue_delivery o
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_delivery_overdue = ROW_COUNT;

  -- 3) Auto-disputa em 30 dias sem conclusão e sem disputa aberta
  FOR v_tx_id IN
    SELECT t.id
    FROM public.transactions t
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
  LOOP
    PERFORM public.system_create_dispute(
      v_tx_id,
      'Não entregue em 30 dias (abertura automática)',
      'under_review'
    );

    INSERT INTO public.escrow_sla_events (transaction_id, event_type, metadata)
    VALUES (v_tx_id, 'auto_dispute_30d', jsonb_build_object('threshold_days', 30))
    ON CONFLICT DO NOTHING;

    v_auto_disputes := v_auto_disputes + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ship_overdue_2d_created', v_ship_overdue,
    'delivery_overdue_14d_created', v_delivery_overdue,
    'auto_dispute_30d_created', v_auto_disputes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_escrow_sla() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.admin_run_escrow_sla()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Não autenticado');
  END IF;

  SELECT (p.is_admin = true) INTO v_is_admin
  FROM public.profiles p
  WHERE p.id = v_uid;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sem permissão');
  END IF;

  RETURN jsonb_build_object('success', true, 'result', public.run_escrow_sla());
END;
$$;

REVOKE ALL ON FUNCTION public.admin_run_escrow_sla() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_run_escrow_sla() TO authenticated;

-- (Opcional) Agendar execução automática via pg_cron, se disponível.
-- Caso o seu projeto não tenha pg_cron habilitado, isso não fará nada.
DO $$
DECLARE
  v_has_cron boolean := false;
  v_exists boolean := false;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') INTO v_has_cron;

  IF v_has_cron THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = ''escrow_sla_15m'')' INTO v_exists;
    IF NOT v_exists THEN
      EXECUTE $$SELECT cron.schedule('escrow_sla_15m', '*/15 * * * *', $$SELECT public.run_escrow_sla();$$)$$;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'dispute_refund_tasks'
  ) THEN
    CREATE TABLE public.dispute_refund_tasks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dispute_id uuid NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
      transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
      buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
      seller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      status text NOT NULL DEFAULT 'pending_execution',
      requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      requested_at timestamptz NOT NULL DEFAULT now(),
      executed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      executed_at timestamptz,
      execution_note text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS dispute_refund_tasks_dispute_unique ON public.dispute_refund_tasks(dispute_id);
CREATE INDEX IF NOT EXISTS dispute_refund_tasks_status_idx ON public.dispute_refund_tasks(status);
CREATE INDEX IF NOT EXISTS dispute_refund_tasks_requested_at_idx ON public.dispute_refund_tasks(requested_at DESC);

ALTER TABLE public.dispute_refund_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Refund tasks admin read" ON public.dispute_refund_tasks;
CREATE POLICY "Refund tasks admin read"
ON public.dispute_refund_tasks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
);

DROP POLICY IF EXISTS "Refund tasks admin update" ON public.dispute_refund_tasks;
CREATE POLICY "Refund tasks admin update"
ON public.dispute_refund_tasks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
);

DROP POLICY IF EXISTS "Refund tasks deny insert" ON public.dispute_refund_tasks;
CREATE POLICY "Refund tasks deny insert"
ON public.dispute_refund_tasks
FOR INSERT
WITH CHECK (false);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dispute_refund_tasks_status_check'
      AND conrelid = 'public.dispute_refund_tasks'::regclass
  ) THEN
    ALTER TABLE public.dispute_refund_tasks
    ADD CONSTRAINT dispute_refund_tasks_status_check
    CHECK (status IN ('pending_execution', 'executed', 'cancelled')) NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_mark_refund_executed(p_dispute_id uuid, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_dispute record;
  v_note text := NULLIF(trim(coalesce(p_note, '')), '');
  v_item_title text := NULL;
  v_item_id uuid := NULL;
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

  SELECT d.id, d.transaction_id, d.buyer_id, d.seller_id, d.status
  INTO v_dispute
  FROM public.disputes d
  WHERE d.id = p_dispute_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Disputa não encontrada');
  END IF;

  UPDATE public.dispute_refund_tasks
  SET status = 'executed',
      executed_by = v_uid,
      executed_at = now(),
      execution_note = v_note
  WHERE dispute_id = p_dispute_id
    AND status = 'pending_execution';

  UPDATE public.disputes
  SET status = 'resolved_refund',
      updated_at = now(),
      metadata = jsonb_strip_nulls(metadata || jsonb_build_object('refund_executed_at', now(), 'refund_execution_note', v_note))
  WHERE id = p_dispute_id;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    SELECT t.item_id INTO v_item_id FROM public.transactions t WHERE t.id = v_dispute.transaction_id;
    IF v_item_id IS NOT NULL THEN
      SELECT i.title INTO v_item_title FROM public.items i WHERE i.id = v_item_id;
    END IF;

    IF v_dispute.buyer_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, item_id, related_id, dedupe_key, is_read, created_at)
      VALUES (
        v_dispute.buyer_id,
        'system',
        'REEMBOLSO EXECUTADO',
        COALESCE('Item: ' || COALESCE(v_item_title, 'Item') || ' • Seu reembolso foi processado.', 'Seu reembolso foi processado.'),
        v_item_id,
        p_dispute_id,
        'dispute:refund_executed:' || p_dispute_id::text || ':' || v_dispute.buyer_id::text,
        false,
        now()
      )
      ON CONFLICT (user_id, dedupe_key) DO NOTHING;
    END IF;

    IF v_dispute.seller_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, item_id, related_id, dedupe_key, is_read, created_at)
      VALUES (
        v_dispute.seller_id,
        'system',
        'REEMBOLSO EXECUTADO',
        COALESCE('Item: ' || COALESCE(v_item_title, 'Item') || ' • A disputa foi encerrada com reembolso.', 'A disputa foi encerrada com reembolso.'),
        v_item_id,
        p_dispute_id,
        'dispute:refund_executed:' || p_dispute_id::text || ':' || v_dispute.seller_id::text,
        false,
        now()
      )
      ON CONFLICT (user_id, dedupe_key) DO NOTHING;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Reembolso marcado como executado');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_mark_refund_executed(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_mark_refund_executed(uuid, text) TO authenticated;


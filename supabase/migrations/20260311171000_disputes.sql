DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'disputes'
  ) THEN
    CREATE TABLE public.disputes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
      opened_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
      buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
      seller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      status text NOT NULL DEFAULT 'open',
      reason text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      resolved_at timestamptz,
      admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE INDEX disputes_transaction_id_idx ON public.disputes(transaction_id);
    CREATE INDEX disputes_buyer_id_idx ON public.disputes(buyer_id);
    CREATE INDEX disputes_seller_id_idx ON public.disputes(seller_id);
    CREATE INDEX disputes_status_idx ON public.disputes(status);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'dispute_messages'
  ) THEN
    CREATE TABLE public.dispute_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dispute_id uuid NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
      sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
      body text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX dispute_messages_dispute_id_idx ON public.dispute_messages(dispute_id);
    CREATE INDEX dispute_messages_sender_id_idx ON public.dispute_messages(sender_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'dispute_evidence'
  ) THEN
    CREATE TABLE public.dispute_evidence (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dispute_id uuid NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
      uploader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
      file_path text NOT NULL,
      file_name text,
      mime_type text,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX dispute_evidence_dispute_id_idx ON public.dispute_evidence(dispute_id);
    CREATE INDEX dispute_evidence_uploader_id_idx ON public.dispute_evidence(uploader_id);
  END IF;
END $$;

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Disputes select participants" ON public.disputes;
CREATE POLICY "Disputes select participants"
ON public.disputes
FOR SELECT
USING (
  buyer_id = auth.uid()
  OR seller_id = auth.uid()
  OR opened_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
);

DROP POLICY IF EXISTS "Disputes insert participants" ON public.disputes;
CREATE POLICY "Disputes insert participants"
ON public.disputes
FOR INSERT
WITH CHECK (
  opened_by = auth.uid()
  AND (buyer_id = auth.uid() OR seller_id = auth.uid())
);

DROP POLICY IF EXISTS "Disputes update admin" ON public.disputes;
CREATE POLICY "Disputes update admin"
ON public.disputes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
);

DROP POLICY IF EXISTS "Dispute messages select participants" ON public.dispute_messages;
CREATE POLICY "Dispute messages select participants"
ON public.dispute_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.disputes d
    WHERE d.id = dispute_messages.dispute_id
      AND (
        d.buyer_id = auth.uid()
        OR d.seller_id = auth.uid()
        OR d.opened_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
      )
  )
);

DROP POLICY IF EXISTS "Dispute messages insert participants" ON public.dispute_messages;
CREATE POLICY "Dispute messages insert participants"
ON public.dispute_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.disputes d
    WHERE d.id = dispute_messages.dispute_id
      AND (
        d.buyer_id = auth.uid()
        OR d.seller_id = auth.uid()
        OR d.opened_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
      )
  )
);

DROP POLICY IF EXISTS "Dispute evidence select participants" ON public.dispute_evidence;
CREATE POLICY "Dispute evidence select participants"
ON public.dispute_evidence
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.disputes d
    WHERE d.id = dispute_evidence.dispute_id
      AND (
        d.buyer_id = auth.uid()
        OR d.seller_id = auth.uid()
        OR d.opened_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
      )
  )
);

DROP POLICY IF EXISTS "Dispute evidence insert participants" ON public.dispute_evidence;
CREATE POLICY "Dispute evidence insert participants"
ON public.dispute_evidence
FOR INSERT
WITH CHECK (
  uploader_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.disputes d
    WHERE d.id = dispute_evidence.dispute_id
      AND (
        d.buyer_id = auth.uid()
        OR d.seller_id = auth.uid()
        OR d.opened_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
      )
  )
);

CREATE OR REPLACE FUNCTION public.open_dispute(p_transaction_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tx record;
  v_existing uuid;
  v_id uuid;
  v_reason text := NULLIF(trim(coalesce(p_reason, '')), '');
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Não autenticado');
  END IF;

  SELECT id, buyer_id, seller_id, status, delivered_at, created_at
  INTO v_tx
  FROM public.transactions
  WHERE id = p_transaction_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Transação não encontrada');
  END IF;

  IF v_uid <> v_tx.buyer_id AND v_uid <> v_tx.seller_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sem permissão para abrir disputa');
  END IF;

  IF v_tx.status NOT IN ('enviado', 'concluido') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Disputa disponível apenas após envio/recebimento');
  END IF;

  SELECT d.id
  INTO v_existing
  FROM public.disputes d
  WHERE d.transaction_id = p_transaction_id
    AND d.status IN ('open', 'awaiting_seller', 'awaiting_buyer', 'under_review')
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'disputeId', v_existing, 'message', 'Disputa já aberta');
  END IF;

  INSERT INTO public.disputes (transaction_id, opened_by, buyer_id, seller_id, status, reason, created_at, updated_at)
  VALUES (p_transaction_id, v_uid, v_tx.buyer_id, v_tx.seller_id, 'open', v_reason, now(), now())
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'disputeId', v_id, 'message', 'Disputa aberta');
END;
$$;

REVOKE ALL ON FUNCTION public.open_dispute(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_dispute(uuid, text) TO authenticated;


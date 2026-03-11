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
  v_item_title text := NULL;
  v_recipient uuid := NULL;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Não autenticado');
  END IF;

  SELECT id, buyer_id, seller_id, status, delivered_at, created_at, item_id
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

  IF v_tx.status = 'concluido' THEN
    IF COALESCE(v_tx.delivered_at, v_tx.created_at) < now() - interval '7 days' THEN
      RETURN jsonb_build_object('success', false, 'message', 'Prazo para abrir disputa expirado (7 dias)');
    END IF;
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

  IF to_regclass('public.notifications') IS NOT NULL THEN
    SELECT i.title INTO v_item_title FROM public.items i WHERE i.id = v_tx.item_id;

    IF v_uid = v_tx.buyer_id THEN
      v_recipient := v_tx.seller_id;
    ELSE
      v_recipient := v_tx.buyer_id;
    END IF;

    IF v_recipient IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, item_id, related_id, dedupe_key, is_read, created_at)
      VALUES (
        v_recipient,
        'system',
        'DISPUTA ABERTA',
        COALESCE('Uma disputa foi aberta: ' || COALESCE(v_item_title, 'Item') || '.', 'Uma disputa foi aberta.'),
        v_tx.item_id,
        v_id,
        'dispute:open:' || p_transaction_id::text || ':' || v_recipient::text,
        false,
        now()
      )
      ON CONFLICT (user_id, dedupe_key) DO NOTHING;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, message, item_id, related_id, dedupe_key, is_read, created_at)
    SELECT
      p.id,
      'system',
      'NOVA DISPUTA',
      COALESCE('Nova disputa: ' || COALESCE(v_item_title, 'Item') || '.', 'Nova disputa.'),
      v_tx.item_id,
      v_id,
      'dispute:new:' || v_id::text || ':' || p.id::text,
      false,
      now()
    FROM public.profiles p
    WHERE p.is_admin = true
    ON CONFLICT (user_id, dedupe_key) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('success', true, 'disputeId', v_id, 'message', 'Disputa aberta');
END;
$$;

REVOKE ALL ON FUNCTION public.open_dispute(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_dispute(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_dispute_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispute record;
  v_item_id uuid := NULL;
  v_item_title text := NULL;
  v_body_preview text := NULL;
BEGIN
  IF to_regclass('public.notifications') IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT d.id, d.transaction_id, d.buyer_id, d.seller_id
  INTO v_dispute
  FROM public.disputes d
  WHERE d.id = NEW.dispute_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT t.item_id INTO v_item_id FROM public.transactions t WHERE t.id = v_dispute.transaction_id;
  IF v_item_id IS NOT NULL THEN
    SELECT i.title INTO v_item_title FROM public.items i WHERE i.id = v_item_id;
  END IF;

  v_body_preview := left(coalesce(NEW.body, ''), 140);

  IF NEW.sender_id = v_dispute.buyer_id AND v_dispute.seller_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, item_id, related_id, dedupe_key, is_read, created_at)
    VALUES (
      v_dispute.seller_id,
      'system',
      'NOVA MENSAGEM NA DISPUTA',
      COALESCE('Item: ' || COALESCE(v_item_title, 'Item') || ' • ' || v_body_preview, v_body_preview),
      v_item_id,
      NEW.dispute_id,
      'dispute:msg:' || NEW.id::text || ':' || v_dispute.seller_id::text,
      false,
      now()
    )
    ON CONFLICT (user_id, dedupe_key) DO NOTHING;
  ELSIF NEW.sender_id = v_dispute.seller_id AND v_dispute.buyer_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, item_id, related_id, dedupe_key, is_read, created_at)
    VALUES (
      v_dispute.buyer_id,
      'system',
      'NOVA MENSAGEM NA DISPUTA',
      COALESCE('Item: ' || COALESCE(v_item_title, 'Item') || ' • ' || v_body_preview, v_body_preview),
      v_item_id,
      NEW.dispute_id,
      'dispute:msg:' || NEW.id::text || ':' || v_dispute.buyer_id::text,
      false,
      now()
    )
    ON CONFLICT (user_id, dedupe_key) DO NOTHING;
  ELSE
    IF v_dispute.buyer_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, item_id, related_id, dedupe_key, is_read, created_at)
      VALUES (
        v_dispute.buyer_id,
        'system',
        'NOVA MENSAGEM NA DISPUTA',
        COALESCE('Item: ' || COALESCE(v_item_title, 'Item') || ' • ' || v_body_preview, v_body_preview),
        v_item_id,
        NEW.dispute_id,
        'dispute:msg:' || NEW.id::text || ':' || v_dispute.buyer_id::text,
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
        'NOVA MENSAGEM NA DISPUTA',
        COALESCE('Item: ' || COALESCE(v_item_title, 'Item') || ' • ' || v_body_preview, v_body_preview),
        v_item_id,
        NEW.dispute_id,
        'dispute:msg:' || NEW.id::text || ':' || v_dispute.seller_id::text,
        false,
        now()
      )
      ON CONFLICT (user_id, dedupe_key) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_dispute_message ON public.dispute_messages;
CREATE TRIGGER trg_notify_dispute_message
AFTER INSERT ON public.dispute_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_dispute_message();


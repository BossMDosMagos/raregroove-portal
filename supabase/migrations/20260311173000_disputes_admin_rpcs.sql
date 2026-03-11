CREATE OR REPLACE FUNCTION public.admin_set_dispute_status(p_dispute_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_dispute record;
  v_status text := NULLIF(trim(coalesce(p_status, '')), '');
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

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Status inválido');
  END IF;

  SELECT id, status, transaction_id
  INTO v_dispute
  FROM public.disputes
  WHERE id = p_dispute_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Disputa não encontrada');
  END IF;

  UPDATE public.disputes
  SET status = v_status,
      admin_id = v_uid,
      updated_at = now()
  WHERE id = p_dispute_id;

  RETURN jsonb_build_object('success', true, 'message', 'Status atualizado');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(p_dispute_id uuid, p_resolution text, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_resolution text := lower(trim(coalesce(p_resolution, '')));
  v_note text := NULLIF(trim(coalesce(p_note, '')), '');
  v_dispute record;
  v_tx record;
  v_net numeric := 0;
  v_balance record;
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

  IF v_resolution NOT IN ('refund', 'release', 'reject') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Resolução inválida');
  END IF;

  SELECT *
  INTO v_dispute
  FROM public.disputes
  WHERE id = p_dispute_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Disputa não encontrada');
  END IF;

  SELECT id, buyer_id, seller_id, status, shipping_id, net_amount
  INTO v_tx
  FROM public.transactions
  WHERE id = v_dispute.transaction_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Transação não encontrada');
  END IF;

  v_net := COALESCE(v_tx.net_amount, 0);

  IF v_resolution = 'reject' THEN
    UPDATE public.disputes
    SET status = 'rejected',
        admin_id = v_uid,
        resolved_at = now(),
        updated_at = now(),
        metadata = public.jsonb_strip_nulls(metadata || jsonb_build_object('note', v_note))
    WHERE id = p_dispute_id;

    RETURN jsonb_build_object('success', true, 'message', 'Disputa rejeitada');
  END IF;

  IF v_resolution = 'release' THEN
    UPDATE public.disputes
    SET status = 'resolved_release',
        admin_id = v_uid,
        resolved_at = now(),
        updated_at = now(),
        metadata = public.jsonb_strip_nulls(metadata || jsonb_build_object('note', v_note))
    WHERE id = p_dispute_id;

    IF v_tx.status <> 'concluido' THEN
      UPDATE public.transactions
      SET status = 'concluido',
          delivered_at = COALESCE(delivered_at, now()),
          updated_at = now()
      WHERE id = v_tx.id;

      IF v_tx.shipping_id IS NOT NULL THEN
        UPDATE public.shipping
        SET status = 'delivered'
        WHERE shipping_id = v_tx.shipping_id;
      END IF;

      IF v_tx.seller_id IS NOT NULL THEN
        INSERT INTO public.user_balances (user_id, available_balance, pending_balance)
        VALUES (v_tx.seller_id, 0, 0)
        ON CONFLICT (user_id) DO NOTHING;

        UPDATE public.user_balances
        SET available_balance = COALESCE(available_balance, 0) + v_net,
            pending_balance = GREATEST(COALESCE(pending_balance, 0) - v_net, 0),
            updated_at = now()
        WHERE user_id = v_tx.seller_id;

        INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, user_id, metadata)
        VALUES (
          'disputa',
          p_dispute_id,
          'disputa_liberacao',
          v_net,
          v_tx.seller_id,
          jsonb_build_object('transaction_id', v_tx.id, 'dispute_id', p_dispute_id, 'note', v_note)
        );
      END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Disputa resolvida: liberação');
  END IF;

  UPDATE public.disputes
  SET status = 'resolved_refund',
      admin_id = v_uid,
      resolved_at = now(),
      updated_at = now(),
      metadata = public.jsonb_strip_nulls(metadata || jsonb_build_object('note', v_note))
  WHERE id = p_dispute_id;

  UPDATE public.transactions
  SET status = 'cancelado',
      updated_at = now()
  WHERE id = v_tx.id;

  IF v_tx.shipping_id IS NOT NULL THEN
    UPDATE public.shipping
    SET status = 'cancelled'
    WHERE shipping_id = v_tx.shipping_id;
  END IF;

  IF v_tx.seller_id IS NOT NULL THEN
    INSERT INTO public.user_balances (user_id, available_balance, pending_balance)
    VALUES (v_tx.seller_id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT available_balance, pending_balance
    INTO v_balance
    FROM public.user_balances
    WHERE user_id = v_tx.seller_id;

    IF v_tx.status IN ('pago_em_custodia', 'pago', 'enviado') THEN
      UPDATE public.user_balances
      SET pending_balance = GREATEST(COALESCE(v_balance.pending_balance, 0) - v_net, 0),
          updated_at = now()
      WHERE user_id = v_tx.seller_id;
    ELSIF v_tx.status = 'concluido' THEN
      UPDATE public.user_balances
      SET available_balance = GREATEST(COALESCE(v_balance.available_balance, 0) - v_net, 0),
          updated_at = now()
      WHERE user_id = v_tx.seller_id;
    END IF;

    INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, user_id, metadata)
    VALUES (
      'disputa',
      p_dispute_id,
      'disputa_reembolso',
      -v_net,
      v_tx.seller_id,
      jsonb_build_object('transaction_id', v_tx.id, 'dispute_id', p_dispute_id, 'note', v_note, 'previous_transaction_status', v_tx.status)
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Disputa resolvida: reembolso');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_dispute_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_dispute_status(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_resolve_dispute(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_dispute(uuid, text, text) TO authenticated;


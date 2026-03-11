-- Escrow core (versionado): RPCs usadas no front + colunas auxiliares

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'shipped_at'
  ) THEN
    ALTER TABLE public.transactions ADD COLUMN shipped_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE public.transactions ADD COLUMN delivered_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'withdrawals'
  ) THEN
    CREATE TABLE public.withdrawals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      amount numeric NOT NULL,
      pix_key text,
      status text NOT NULL DEFAULT 'pendente',
      requested_at timestamptz NOT NULL DEFAULT now(),
      processed_at timestamptz,
      admin_proof_file_path text,
      proof_original_filename text,
      proof_expires_at timestamptz,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    );
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.get_user_financials(uuid);
DROP FUNCTION IF EXISTS public.add_tracking_code(uuid, text);
DROP FUNCTION IF EXISTS public.confirm_delivery(uuid);
DROP FUNCTION IF EXISTS public.create_withdrawal(uuid, numeric, text);

CREATE OR REPLACE FUNCTION public.get_user_financials(user_uuid uuid)
RETURNS TABLE(
  saldo_disponivel numeric,
  saldo_pendente numeric,
  total_vendas integer,
  vendas_concluidas integer,
  vendas_em_andamento integer,
  ticket_medio numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available numeric := 0;
  v_pending numeric := 0;
  v_total integer := 0;
  v_done integer := 0;
  v_in_progress integer := 0;
  v_avg numeric := 0;
BEGIN
  SELECT COALESCE(ub.available_balance, 0), COALESCE(ub.pending_balance, 0)
  INTO v_available, v_pending
  FROM public.user_balances ub
  WHERE ub.user_id = user_uuid;

  SELECT COUNT(*)::int,
         COUNT(*) FILTER (WHERE status = 'concluido')::int,
         COUNT(*) FILTER (WHERE status IN ('pago_em_custodia', 'pago', 'enviado'))::int,
         COALESCE(AVG(price) FILTER (WHERE status IN ('concluido', 'enviado', 'pago_em_custodia', 'pago')), 0)
  INTO v_total, v_done, v_in_progress, v_avg
  FROM public.transactions
  WHERE seller_id = user_uuid
    AND transaction_type IN ('venda');

  saldo_disponivel := v_available;
  saldo_pendente := v_pending;
  total_vendas := v_total;
  vendas_concluidas := v_done;
  vendas_em_andamento := v_in_progress;
  ticket_medio := v_avg;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_tracking_code(p_transaction_id uuid, p_tracking_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tx record;
  v_shipping_id uuid;
  v_code text := upper(trim(coalesce(p_tracking_code, '')));
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Não autenticado');
  END IF;

  IF v_code = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Código de rastreio obrigatório');
  END IF;

  SELECT id, seller_id, buyer_id, status, shipping_id
  INTO v_tx
  FROM public.transactions
  WHERE id = p_transaction_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Transação não encontrada');
  END IF;

  IF v_tx.seller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Venda do portal não aceita rastreio via conta de vendedor');
  END IF;

  IF v_tx.seller_id <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sem permissão para atualizar esta transação');
  END IF;

  IF v_tx.status NOT IN ('pago_em_custodia', 'pago') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Status inválido para envio');
  END IF;

  v_shipping_id := v_tx.shipping_id;
  IF v_shipping_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Registro de envio não encontrado');
  END IF;

  UPDATE public.shipping
  SET tracking_code = v_code,
      status = 'in_transit'
  WHERE shipping_id = v_shipping_id;

  UPDATE public.transactions
  SET status = 'enviado',
      shipped_at = COALESCE(shipped_at, now()),
      updated_at = now()
  WHERE id = p_transaction_id;

  RETURN jsonb_build_object('success', true, 'message', 'Código de rastreio salvo');
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_delivery(p_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tx record;
  v_net numeric;
  v_has_dispute boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Não autenticado');
  END IF;

  SELECT id, buyer_id, seller_id, status, shipping_id, net_amount
  INTO v_tx
  FROM public.transactions
  WHERE id = p_transaction_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Transação não encontrada');
  END IF;

  IF v_tx.buyer_id <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sem permissão para confirmar esta entrega');
  END IF;

  IF v_tx.status <> 'enviado' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Status inválido para confirmação');
  END IF;

  IF to_regclass('public.disputes') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.disputes d
      WHERE d.transaction_id = p_transaction_id
        AND d.status IN ('open', 'awaiting_seller', 'awaiting_buyer', 'under_review')
    ) INTO v_has_dispute;
  END IF;

  IF v_has_dispute THEN
    RETURN jsonb_build_object('success', false, 'message', 'Existe uma disputa em aberto para esta transação');
  END IF;

  UPDATE public.transactions
  SET status = 'concluido',
      delivered_at = COALESCE(delivered_at, now()),
      updated_at = now()
  WHERE id = p_transaction_id;

  IF v_tx.shipping_id IS NOT NULL THEN
    UPDATE public.shipping
    SET status = 'delivered'
    WHERE shipping_id = v_tx.shipping_id;
  END IF;

  IF v_tx.seller_id IS NOT NULL THEN
    v_net := COALESCE(v_tx.net_amount, 0);

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
      'venda',
      p_transaction_id,
      'saldo_liberado',
      v_net,
      v_tx.seller_id,
      jsonb_build_object('transaction_id', p_transaction_id, 'description', 'Liberação de custódia após confirmação de entrega')
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Entrega confirmada');
END;
$$;

CREATE OR REPLACE FUNCTION public.create_withdrawal(user_uuid uuid, amount numeric, pix_key text)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_available numeric := 0;
  v_active boolean := false;
BEGIN
  IF v_uid IS NULL OR v_uid <> user_uuid THEN
    RETURN QUERY SELECT false, 'Sem permissão';
    RETURN;
  END IF;

  SELECT COALESCE(available_balance, 0)
  INTO v_available
  FROM public.user_balances
  WHERE user_id = user_uuid;

  IF COALESCE(amount, 0) <= 0 THEN
    RETURN QUERY SELECT false, 'Valor inválido';
    RETURN;
  END IF;

  IF v_available < amount THEN
    RETURN QUERY SELECT false, 'Saldo insuficiente';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.withdrawals w
    WHERE w.user_id = user_uuid
      AND w.status IN ('pendente', 'em_analise')
  ) INTO v_active;

  IF v_active THEN
    RETURN QUERY SELECT false, 'Você já possui um saque em análise';
    RETURN;
  END IF;

  INSERT INTO public.withdrawals (user_id, amount, pix_key, status, requested_at)
  VALUES (user_uuid, amount, pix_key, 'pendente', now());

  UPDATE public.user_balances
  SET available_balance = COALESCE(available_balance, 0) - amount,
      updated_at = now()
  WHERE user_id = user_uuid;

  INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, user_id, metadata)
  VALUES (
    'saque',
    NULL,
    'saque_solicitado',
    -amount,
    user_uuid,
    jsonb_build_object('amount', amount, 'pix_key', pix_key)
  );

  RETURN QUERY SELECT true, 'Solicitação registrada';
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_financials(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_financials(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.add_tracking_code(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_tracking_code(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.confirm_delivery(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_delivery(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.create_withdrawal(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_withdrawal(uuid, numeric, text) TO authenticated;

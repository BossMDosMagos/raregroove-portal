-- =============================================================================
-- RAREGROOVE | TROCAS P2P COM CUSTÓDIA FINANCEIRA (DB ROUTES + STATUS)
-- Data: 2026-03-05
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1) EVOLUÇÃO DE SCHEMA
-- =============================================================================
ALTER TABLE public.swaps
  ADD COLUMN IF NOT EXISTS item_1_declared_value numeric(12,2),
  ADD COLUMN IF NOT EXISTS item_2_declared_value numeric(12,2),
  ADD COLUMN IF NOT EXISTS platform_fee_user_1 numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee_user_2 numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS value_diff_to_user_2 numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checkin_amount_user_1 numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checkin_amount_user_2 numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checkin_paid_amount_user_1 numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checkin_paid_amount_user_2 numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS insurance_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS insurance_user_1_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS insurance_user_2_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS user_1_receipt_ok_at timestamptz,
  ADD COLUMN IF NOT EXISTS user_2_receipt_ok_at timestamptz,
  ADD COLUMN IF NOT EXISTS incident_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS incident_reason text,
  ADD COLUMN IF NOT EXISTS incident_fault_user_id uuid,
  ADD COLUMN IF NOT EXISTS incident_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS incident_resolution_notes text;

-- Backfill de compatibilidade para fluxo legado (TROCAR no catálogo)
UPDATE public.swaps
SET
  checkin_amount_user_1 = CASE WHEN COALESCE(checkin_amount_user_1, 0) <= 0 THEN COALESCE(guarantee_fee_amount, 0) ELSE checkin_amount_user_1 END,
  checkin_amount_user_2 = CASE WHEN COALESCE(checkin_amount_user_2, 0) <= 0 THEN COALESCE(guarantee_fee_amount, 0) ELSE checkin_amount_user_2 END,
  insurance_required = CASE
    WHEN status IN ('aguardando_taxas', 'autorizado_envio', 'em_troca', 'concluido', 'cancelado')
      THEN false
    ELSE insurance_required
  END,
  updated_at = now()
WHERE COALESCE(checkin_amount_user_1, 0) <= 0
   OR COALESCE(checkin_amount_user_2, 0) <= 0
   OR status IN ('aguardando_taxas', 'autorizado_envio', 'em_troca', 'concluido', 'cancelado');

-- Remover check antigo antes de converter status para novos valores
ALTER TABLE public.swaps DROP CONSTRAINT IF EXISTS swaps_status_check;

-- Normalização de legado
UPDATE public.swaps SET status = 'aguardando_checkin' WHERE status = 'aguardando_taxas';
UPDATE public.swaps SET status = 'etiquetas_liberadas' WHERE status = 'autorizado_envio';
UPDATE public.swaps SET status = 'em_transito' WHERE status = 'em_troca';
UPDATE public.swaps SET status = 'concluida' WHERE status = 'concluido';
UPDATE public.swaps SET status = 'cancelada' WHERE status = 'cancelado';

ALTER TABLE public.swaps ADD CONSTRAINT swaps_status_check CHECK (
  status IN (
    'proposta_criada',
    'aguardando_checkin',
    'checkin_parcial',
    'etiquetas_liberadas',
    'em_transito',
    'aguardando_confirmacao_recebimento',
    'concluida',
    'sinistro_aberto',
    'sinistro_em_analise',
    'sinistro_resolvido_venda_reversa',
    'cancelada',

    -- legados (compatibilidade)
    'aguardando_taxas',
    'autorizado_envio',
    'em_troca',
    'concluido',
    'cancelado'
  )
);

CREATE INDEX IF NOT EXISTS idx_swaps_status_updated ON public.swaps(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_swaps_incident_opened ON public.swaps(incident_opened_at) WHERE incident_opened_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.swaps_legacy_compat_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NEW.checkin_amount_user_1, 0) <= 0 THEN
    NEW.checkin_amount_user_1 := COALESCE(NEW.guarantee_fee_amount, 0);
  END IF;

  IF COALESCE(NEW.checkin_amount_user_2, 0) <= 0 THEN
    NEW.checkin_amount_user_2 := COALESCE(NEW.guarantee_fee_amount, 0);
  END IF;

  IF NEW.status IN ('aguardando_taxas', 'autorizado_envio', 'em_troca', 'concluido', 'cancelado') THEN
    NEW.insurance_required := false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_swaps_legacy_compat_defaults ON public.swaps;
CREATE TRIGGER trg_swaps_legacy_compat_defaults
BEFORE INSERT ON public.swaps
FOR EACH ROW
EXECUTE FUNCTION public.swaps_legacy_compat_defaults();

-- =============================================================================
-- 2) HELPERS
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND p.is_admin = true
  );
$$;

-- =============================================================================
-- 3) ROTA: CRIAR TROCA EM CUSTÓDIA
--    A paga: valor item B + taxa + diferença (se houver)
--    B paga: valor item A + taxa
-- =============================================================================
CREATE OR REPLACE FUNCTION public.swap_create_escrow(
  p_user_2_id uuid,
  p_item_1_id uuid,
  p_item_2_id uuid,
  p_item_1_declared_value numeric,
  p_item_2_declared_value numeric,
  p_platform_fee numeric,
  p_value_diff_to_user_2 numeric DEFAULT 0,
  p_insurance_required boolean DEFAULT true
)
RETURNS TABLE (
  success boolean,
  message text,
  swap_id uuid,
  amount_due_user_1 numeric,
  amount_due_user_2 numeric,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_1 uuid := auth.uid();
  v_swap_id uuid;
  v_due_1 numeric(12,2);
  v_due_2 numeric(12,2);
BEGIN
  IF v_user_1 IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF v_user_1 = p_user_2_id THEN
    RAISE EXCEPTION 'Usuário não pode propor troca para si mesmo';
  END IF;

  IF COALESCE(p_item_1_declared_value, 0) <= 0 OR COALESCE(p_item_2_declared_value, 0) <= 0 THEN
    RAISE EXCEPTION 'Valores venais dos itens devem ser maiores que zero';
  END IF;

  IF COALESCE(p_platform_fee, 0) < 0 OR COALESCE(p_value_diff_to_user_2, 0) < 0 THEN
    RAISE EXCEPTION 'Taxa e diferença não podem ser negativas';
  END IF;

  v_due_1 := p_item_2_declared_value + p_platform_fee + p_value_diff_to_user_2;
  v_due_2 := p_item_1_declared_value + p_platform_fee;

  INSERT INTO public.swaps (
    user_1_id,
    user_2_id,
    item_1_id,
    item_2_id,
    item_1_declared_value,
    item_2_declared_value,
    platform_fee_user_1,
    platform_fee_user_2,
    value_diff_to_user_2,
    checkin_amount_user_1,
    checkin_amount_user_2,
    guarantee_fee_amount,
    status,
    insurance_required,
    user_1_item_reserved,
    user_2_item_reserved,
    created_at,
    updated_at
  ) VALUES (
    v_user_1,
    p_user_2_id,
    p_item_1_id,
    p_item_2_id,
    p_item_1_declared_value,
    p_item_2_declared_value,
    p_platform_fee,
    p_platform_fee,
    p_value_diff_to_user_2,
    v_due_1,
    v_due_2,
    p_platform_fee,
    'aguardando_checkin',
    p_insurance_required,
    true,
    false,
    now(),
    now()
  )
  RETURNING swaps.swap_id INTO v_swap_id;

  RETURN QUERY
  SELECT true, 'Troca em custódia criada', v_swap_id, v_due_1, v_due_2, 'aguardando_checkin';
END;
$$;

-- =============================================================================
-- 4) ROTA: ACEITE DE SEGURO DE FRETE (OBRIGATÓRIO)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.swap_accept_insurance_terms(p_swap_id uuid)
RETURNS TABLE (
  success boolean,
  message text,
  insurance_user_1_accepted boolean,
  insurance_user_2_accepted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_swap public.swaps%ROWTYPE;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_swap
  FROM public.swaps
  WHERE swaps.swap_id = p_swap_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Swap não encontrado';
  END IF;

  IF v_uid NOT IN (v_swap.user_1_id, v_swap.user_2_id) THEN
    RAISE EXCEPTION 'Usuário não autorizado para este swap';
  END IF;

  IF NOT v_swap.insurance_required THEN
    RETURN QUERY SELECT true, 'Seguro não é obrigatório neste swap', v_swap.insurance_user_1_accepted, v_swap.insurance_user_2_accepted;
    RETURN;
  END IF;

  UPDATE public.swaps
  SET
    insurance_user_1_accepted = CASE WHEN v_uid = v_swap.user_1_id THEN true ELSE insurance_user_1_accepted END,
    insurance_user_2_accepted = CASE WHEN v_uid = v_swap.user_2_id THEN true ELSE insurance_user_2_accepted END,
    updated_at = now()
  WHERE swaps.swap_id = p_swap_id;

  SELECT * INTO v_swap FROM public.swaps WHERE swaps.swap_id = p_swap_id;

  RETURN QUERY SELECT true, 'Aceite de seguro registrado', v_swap.insurance_user_1_accepted, v_swap.insurance_user_2_accepted;
END;
$$;

-- =============================================================================
-- 5) ROTA: CHECK-IN FINANCEIRO (PAGAMENTO DE GARANTIA)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.swap_register_checkin_payment(
  p_swap_id uuid,
  p_amount numeric,
  p_payment_ref text DEFAULT NULL
)
RETURNS TABLE (
  success boolean,
  message text,
  new_status text,
  my_due_amount numeric,
  both_paid boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_swap public.swaps%ROWTYPE;
  v_uid uuid := auth.uid();
  v_is_user_1 boolean;
  v_due numeric(12,2);
  v_both_paid boolean;
  v_next_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_swap
  FROM public.swaps
  WHERE swaps.swap_id = p_swap_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Swap não encontrado';
  END IF;

  IF v_uid NOT IN (v_swap.user_1_id, v_swap.user_2_id) THEN
    RAISE EXCEPTION 'Usuário não autorizado para este swap';
  END IF;

  IF v_swap.status NOT IN ('proposta_criada', 'aguardando_checkin', 'checkin_parcial', 'aguardando_taxas') THEN
    RAISE EXCEPTION 'Swap não está em fase de check-in';
  END IF;

  IF v_swap.insurance_required
     AND v_swap.status NOT IN ('aguardando_taxas')
     AND NOT (v_swap.insurance_user_1_accepted AND v_swap.insurance_user_2_accepted) THEN
    RAISE EXCEPTION 'Ambos os participantes devem aceitar o termo de seguro de frete antes do check-in';
  END IF;

  v_is_user_1 := (v_uid = v_swap.user_1_id);
  v_due := CASE WHEN v_is_user_1 THEN v_swap.checkin_amount_user_1 ELSE v_swap.checkin_amount_user_2 END;

  IF COALESCE(v_due, 0) <= 0 THEN
    v_due := COALESCE(v_swap.guarantee_fee_amount, 0);
  END IF;

  IF COALESCE(v_due, 0) <= 0 THEN
    v_due := COALESCE(p_amount, 0);
  END IF;

  IF COALESCE(v_due, 0) <= 0 THEN
    RAISE EXCEPTION 'Valor de check-in inválido para o participante';
  END IF;

  IF abs(COALESCE(p_amount, 0) - v_due) > 0.01
     AND v_swap.status NOT IN ('aguardando_taxas') THEN
    RAISE EXCEPTION 'Valor de check-in divergente. Esperado: %, recebido: %', v_due, p_amount;
  END IF;

  UPDATE public.swaps
  SET
    checkin_paid_amount_user_1 = CASE WHEN v_is_user_1 THEN p_amount ELSE checkin_paid_amount_user_1 END,
    checkin_paid_amount_user_2 = CASE WHEN v_is_user_1 THEN checkin_paid_amount_user_2 ELSE p_amount END,
    guarantee_fee_1_paid = CASE WHEN v_is_user_1 THEN true ELSE guarantee_fee_1_paid END,
    guarantee_fee_2_paid = CASE WHEN v_is_user_1 THEN guarantee_fee_2_paid ELSE true END,
    status = CASE
      WHEN (CASE WHEN v_is_user_1 THEN true ELSE guarantee_fee_1_paid END)
        AND (CASE WHEN v_is_user_1 THEN guarantee_fee_2_paid ELSE true END)
      THEN 'etiquetas_liberadas'
      ELSE 'checkin_parcial'
    END,
    authorized_at = CASE
      WHEN (CASE WHEN v_is_user_1 THEN true ELSE guarantee_fee_1_paid END)
        AND (CASE WHEN v_is_user_1 THEN guarantee_fee_2_paid ELSE true END)
      THEN now()
      ELSE authorized_at
    END,
    updated_at = now()
  WHERE swaps.swap_id = p_swap_id;

  SELECT * INTO v_swap FROM public.swaps WHERE swaps.swap_id = p_swap_id;
  v_both_paid := v_swap.guarantee_fee_1_paid AND v_swap.guarantee_fee_2_paid;
  v_next_status := v_swap.status;

  INSERT INTO public.financial_ledger (
    source_type,
    source_id,
    entry_type,
    amount,
    user_id,
    metadata
  ) VALUES (
    'troca',
    p_swap_id,
    'taxa_garantia_troca',
    p_amount,
    v_uid,
    jsonb_build_object(
      'rota', 'swap_register_checkin_payment',
      'payment_ref', p_payment_ref,
      'is_user_1', v_is_user_1,
      'due_amount', v_due,
      'status_after', v_next_status
    )
  );

  RETURN QUERY
  SELECT true,
         CASE WHEN v_both_paid
           THEN 'Check-in completo: etiquetas liberadas'
           ELSE 'Check-in registrado: aguardando outra parte'
         END,
         v_next_status,
         v_due,
         v_both_paid;
END;
$$;

-- =============================================================================
-- 6) ROTA: MARCAR ENVIO / TRÂNSITO (APÓS ETIQUETAS)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.swap_mark_in_transit(p_swap_id uuid)
RETURNS TABLE (
  success boolean,
  message text,
  new_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_swap public.swaps%ROWTYPE;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_swap
  FROM public.swaps
  WHERE swaps.swap_id = p_swap_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Swap não encontrado';
  END IF;

  IF v_uid NOT IN (v_swap.user_1_id, v_swap.user_2_id) AND NOT public.is_admin_user(v_uid) THEN
    RAISE EXCEPTION 'Usuário não autorizado para movimentar este swap';
  END IF;

  IF v_swap.status NOT IN ('etiquetas_liberadas', 'autorizado_envio') THEN
    RAISE EXCEPTION 'Swap não está liberado para envio';
  END IF;

  UPDATE public.swaps
  SET status = 'em_transito', updated_at = now()
  WHERE swaps.swap_id = p_swap_id;

  RETURN QUERY SELECT true, 'Swap marcado como em trânsito', 'em_transito';
END;
$$;

-- =============================================================================
-- 7) ROTA: CONFIRMAÇÃO DE RECEBIMENTO OK
--    Se ambos confirmarem: devolve garantias e retém apenas taxas
-- =============================================================================
CREATE OR REPLACE FUNCTION public.swap_confirm_receipt_ok(p_swap_id uuid)
RETURNS TABLE (
  success boolean,
  message text,
  new_status text,
  both_confirmed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_swap public.swaps%ROWTYPE;
  v_uid uuid := auth.uid();
  v_is_user_1 boolean;
  v_both_confirmed boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_swap
  FROM public.swaps
  WHERE swaps.swap_id = p_swap_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Swap não encontrado';
  END IF;

  IF v_uid NOT IN (v_swap.user_1_id, v_swap.user_2_id) THEN
    RAISE EXCEPTION 'Usuário não autorizado para este swap';
  END IF;

  IF v_swap.status NOT IN ('etiquetas_liberadas', 'autorizado_envio', 'em_transito', 'aguardando_confirmacao_recebimento') THEN
    RAISE EXCEPTION 'Swap não está apto para confirmação de recebimento';
  END IF;

  v_is_user_1 := (v_uid = v_swap.user_1_id);

  UPDATE public.swaps
  SET
    user_1_confirmed = CASE WHEN v_is_user_1 THEN true ELSE user_1_confirmed END,
    user_2_confirmed = CASE WHEN v_is_user_1 THEN user_2_confirmed ELSE true END,
    user_1_receipt_ok_at = CASE WHEN v_is_user_1 THEN now() ELSE user_1_receipt_ok_at END,
    user_2_receipt_ok_at = CASE WHEN v_is_user_1 THEN user_2_receipt_ok_at ELSE now() END,
    status = CASE
      WHEN (CASE WHEN v_is_user_1 THEN true ELSE user_1_confirmed END)
       AND (CASE WHEN v_is_user_1 THEN user_2_confirmed ELSE true END)
      THEN 'concluida'
      ELSE 'aguardando_confirmacao_recebimento'
    END,
    completed_at = CASE
      WHEN (CASE WHEN v_is_user_1 THEN true ELSE user_1_confirmed END)
       AND (CASE WHEN v_is_user_1 THEN user_2_confirmed ELSE true END)
      THEN now()
      ELSE completed_at
    END,
    updated_at = now()
  WHERE swaps.swap_id = p_swap_id;

  SELECT * INTO v_swap FROM public.swaps WHERE swaps.swap_id = p_swap_id;
  v_both_confirmed := v_swap.user_1_confirmed AND v_swap.user_2_confirmed;

  IF v_both_confirmed THEN
    -- Devolução integral das garantias
    INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, user_id, metadata)
    VALUES
      ('troca', p_swap_id, 'custodia_saida', v_swap.checkin_paid_amount_user_1, v_swap.user_1_id,
        jsonb_build_object('rota', 'swap_confirm_receipt_ok', 'evento', 'refund_garantia', 'participant', 'user_1')),
      ('troca', p_swap_id, 'custodia_saida', v_swap.checkin_paid_amount_user_2, v_swap.user_2_id,
        jsonb_build_object('rota', 'swap_confirm_receipt_ok', 'evento', 'refund_garantia', 'participant', 'user_2'));

    -- Retenção das taxas de permuta
    INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, metadata)
    VALUES
      ('troca', p_swap_id, 'taxa_permuta_retida', COALESCE(v_swap.platform_fee_user_1, 0),
        jsonb_build_object('rota', 'swap_confirm_receipt_ok', 'participant', 'user_1')),
      ('troca', p_swap_id, 'taxa_permuta_retida', COALESCE(v_swap.platform_fee_user_2, 0),
        jsonb_build_object('rota', 'swap_confirm_receipt_ok', 'participant', 'user_2'));

    -- Repassar diferença acordada para o usuário B (se houver)
    IF COALESCE(v_swap.value_diff_to_user_2, 0) > 0 THEN
      INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, user_id, metadata)
      VALUES (
        'troca',
        p_swap_id,
        'diferenca_repassada',
        v_swap.value_diff_to_user_2,
        v_swap.user_2_id,
        jsonb_build_object('rota', 'swap_confirm_receipt_ok', 'from', 'user_1', 'to', 'user_2')
      );
    END IF;

    RETURN QUERY SELECT true, 'Troca concluída com devolução de garantias e retenção de taxas', 'concluida', true;
  END IF;

  RETURN QUERY SELECT true, 'Recebimento OK registrado. Aguardando confirmação da outra parte', 'aguardando_confirmacao_recebimento', false;
END;
$$;

-- =============================================================================
-- 8) ROTA: ABRIR SINISTRO/EXTRAVIO
-- =============================================================================
CREATE OR REPLACE FUNCTION public.swap_open_incident(
  p_swap_id uuid,
  p_reason text
)
RETURNS TABLE (
  success boolean,
  message text,
  new_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_swap public.swaps%ROWTYPE;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF trim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Motivo do sinistro é obrigatório';
  END IF;

  SELECT * INTO v_swap
  FROM public.swaps
  WHERE swaps.swap_id = p_swap_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Swap não encontrado';
  END IF;

  IF v_uid NOT IN (v_swap.user_1_id, v_swap.user_2_id) THEN
    RAISE EXCEPTION 'Usuário não autorizado para este swap';
  END IF;

  IF v_swap.status NOT IN ('etiquetas_liberadas', 'autorizado_envio', 'em_transito', 'aguardando_confirmacao_recebimento') THEN
    RAISE EXCEPTION 'Status atual não permite abertura de sinistro';
  END IF;

  UPDATE public.swaps
  SET
    status = 'sinistro_aberto',
    incident_opened_at = now(),
    incident_reason = p_reason,
    updated_at = now()
  WHERE swaps.swap_id = p_swap_id;

  INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, user_id, metadata)
  VALUES (
    'troca',
    p_swap_id,
    'sinistro_aberto',
    0,
    v_uid,
    jsonb_build_object('rota', 'swap_open_incident', 'reason', p_reason)
  );

  RETURN QUERY SELECT true, 'Sinistro aberto e encaminhado para análise', 'sinistro_aberto';
END;
$$;

-- =============================================================================
-- 9) ROTA: RESOLVER SINISTRO (VENDA REVERSA)
--    Regra: depósito do culpado NÃO é devolvido e é usado para indenizar o lesado
-- =============================================================================
CREATE OR REPLACE FUNCTION public.swap_resolve_incident_reverse_sale(
  p_swap_id uuid,
  p_fault_user_id uuid,
  p_resolution_notes text DEFAULT NULL
)
RETURNS TABLE (
  success boolean,
  message text,
  new_status text,
  victim_compensation numeric,
  victim_refund numeric,
  culprit_forfeit numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_swap public.swaps%ROWTYPE;
  v_uid uuid := auth.uid();
  v_victim_user_id uuid;
  v_fault_deposit numeric(12,2);
  v_victim_own_deposit numeric(12,2);
  v_victim_item_value numeric(12,2);
  v_compensation numeric(12,2);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.is_admin_user(v_uid) THEN
    RAISE EXCEPTION 'Apenas administradores podem resolver sinistro';
  END IF;

  SELECT * INTO v_swap
  FROM public.swaps
  WHERE swaps.swap_id = p_swap_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Swap não encontrado';
  END IF;

  IF v_swap.status NOT IN ('sinistro_aberto', 'sinistro_em_analise') THEN
    RAISE EXCEPTION 'Swap não está em fase de sinistro';
  END IF;

  IF p_fault_user_id NOT IN (v_swap.user_1_id, v_swap.user_2_id) THEN
    RAISE EXCEPTION 'Culpado informado não participa deste swap';
  END IF;

  v_victim_user_id := CASE WHEN p_fault_user_id = v_swap.user_1_id THEN v_swap.user_2_id ELSE v_swap.user_1_id END;

  v_fault_deposit := CASE
    WHEN p_fault_user_id = v_swap.user_1_id THEN v_swap.checkin_paid_amount_user_1
    ELSE v_swap.checkin_paid_amount_user_2
  END;

  v_victim_own_deposit := CASE
    WHEN v_victim_user_id = v_swap.user_1_id THEN v_swap.checkin_paid_amount_user_1
    ELSE v_swap.checkin_paid_amount_user_2
  END;

  v_victim_item_value := CASE
    WHEN v_victim_user_id = v_swap.user_1_id THEN v_swap.item_1_declared_value
    ELSE v_swap.item_2_declared_value
  END;

  v_compensation := LEAST(COALESCE(v_fault_deposit, 0), COALESCE(v_victim_item_value, 0));

  UPDATE public.swaps
  SET
    status = 'sinistro_resolvido_venda_reversa',
    incident_fault_user_id = p_fault_user_id,
    incident_resolved_at = now(),
    incident_resolution_notes = COALESCE(p_resolution_notes, 'Sinistro resolvido por venda reversa compulsória'),
    completed_at = now(),
    updated_at = now()
  WHERE swaps.swap_id = p_swap_id;

  -- Depósito do culpado é perdido
  INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, user_id, metadata)
  VALUES (
    'troca',
    p_swap_id,
    'sinistro_deposito_perdido',
    COALESCE(v_fault_deposit, 0),
    p_fault_user_id,
    jsonb_build_object('rota', 'swap_resolve_incident_reverse_sale', 'evento', 'culpado_nao_reembolsado')
  );

  -- Lesado recebe indenização pelo item
  IF v_compensation > 0 THEN
    INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, user_id, metadata)
    VALUES (
      'troca',
      p_swap_id,
      'sinistro_indenizacao_lesado',
      v_compensation,
      v_victim_user_id,
      jsonb_build_object('rota', 'swap_resolve_incident_reverse_sale', 'fault_user_id', p_fault_user_id)
    );
  END IF;

  -- Lesado recebe também a devolução do próprio depósito
  IF COALESCE(v_victim_own_deposit, 0) > 0 THEN
    INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, user_id, metadata)
    VALUES (
      'troca',
      p_swap_id,
      'custodia_saida',
      v_victim_own_deposit,
      v_victim_user_id,
      jsonb_build_object('rota', 'swap_resolve_incident_reverse_sale', 'evento', 'reembolso_lesado')
    );
  END IF;

  RETURN QUERY SELECT true,
    'Sinistro resolvido: venda reversa aplicada e indenização registrada',
    'sinistro_resolvido_venda_reversa',
    COALESCE(v_compensation, 0),
    COALESCE(v_victim_own_deposit, 0),
    COALESCE(v_fault_deposit, 0);
END;
$$;

-- =============================================================================
-- 10) COMPATIBILIDADE COM RPCS LEGADAS (UI ATUAL)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.pay_swap_guarantee(p_swap_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_swap public.swaps%ROWTYPE;
  v_uid uuid := auth.uid();
  v_amount numeric(12,2);
  v_result record;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Usuário não autenticado');
  END IF;

  SELECT * INTO v_swap
  FROM public.swaps
  WHERE swaps.swap_id = p_swap_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Swap não encontrado');
  END IF;

  v_amount := CASE WHEN v_uid = v_swap.user_1_id THEN v_swap.checkin_amount_user_1 ELSE v_swap.checkin_amount_user_2 END;
  IF COALESCE(v_amount, 0) <= 0 THEN
    v_amount := COALESCE(v_swap.guarantee_fee_amount, 0);
  END IF;

  SELECT * INTO v_result
  FROM public.swap_register_checkin_payment(p_swap_id, v_amount, NULL)
  LIMIT 1;

  RETURN json_build_object(
    'success', v_result.success,
    'message', v_result.message,
    'status', v_result.new_status,
    'both_paid', v_result.both_paid
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_swap_receipt(p_swap_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result record;
BEGIN
  SELECT * INTO v_result
  FROM public.swap_confirm_receipt_ok(p_swap_id)
  LIMIT 1;

  RETURN json_build_object(
    'success', v_result.success,
    'message', v_result.message,
    'status', v_result.new_status,
    'both_confirmed', v_result.both_confirmed
  );
END;
$$;

-- =============================================================================
-- 11) VISÃO DE ROTAS DE STATUS (REFERÊNCIA DE ORQUESTRAÇÃO)
-- =============================================================================
CREATE OR REPLACE VIEW public.swap_status_routes AS
SELECT * FROM (
  VALUES
    ('proposta_criada', 'Proposta criada; aguarda cálculo/check-in', 'swap_create_escrow', 'aguardando_checkin'),
    ('aguardando_checkin', 'Ambos aceitam seguro e iniciam pagamento em custódia', 'swap_accept_insurance_terms + swap_register_checkin_payment', 'checkin_parcial / etiquetas_liberadas'),
    ('checkin_parcial', 'Uma parte já pagou, falta a outra', 'swap_register_checkin_payment', 'etiquetas_liberadas'),
    ('etiquetas_liberadas', 'Etiquetas podem ser emitidas', 'swap_mark_in_transit', 'em_transito'),
    ('em_transito', 'Itens em transporte', 'swap_confirm_receipt_ok / swap_open_incident', 'aguardando_confirmacao_recebimento / sinistro_aberto'),
    ('aguardando_confirmacao_recebimento', 'Uma parte confirmou recebimento OK', 'swap_confirm_receipt_ok / swap_open_incident', 'concluida / sinistro_aberto'),
    ('sinistro_aberto', 'Extravio/avaria reportado', 'swap_resolve_incident_reverse_sale', 'sinistro_resolvido_venda_reversa'),
    ('concluida', 'Garantias devolvidas; taxas retidas; diferença repassada', NULL, NULL),
    ('sinistro_resolvido_venda_reversa', 'Depósito do culpado convertido em indenização', NULL, NULL),
    ('cancelada', 'Troca encerrada sem conclusão', NULL, NULL)
) AS t(status, descricao, rota_principal, proximo_status);

COMMIT;

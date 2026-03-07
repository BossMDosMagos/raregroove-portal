-- =============================================================================
-- BANCO VIRTUAL RARE GROOVE - CUSTODIA, TROCAS E CONTROLE FINANCEIRO
-- Data: 25/02/2026
-- =============================================================================
-- Objetivo:
-- 1) Centralizar saldos (user_balances)
-- 2) Registrar taxas e custodia (financial_ledger)
-- 3) Padronizar transacoes (transactions + fees)
-- 4) Gerenciar permutas (swaps)
-- 5) Configurar taxas dinamicas (platform_settings)
-- =============================================================================

-- =============================================================================
-- 0) AJUSTES EM PROFILES (CPF/CNPJ E RG UNICOS)
-- =============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT,
  ADD COLUMN IF NOT EXISTS rg TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_cnpj_unique
  ON public.profiles (cpf_cnpj)
  WHERE cpf_cnpj IS NOT NULL AND cpf_cnpj <> '';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_rg_unique
  ON public.profiles (rg)
  WHERE rg IS NOT NULL AND rg <> '';

-- =============================================================================
-- 1) SETTINGS GLOBAIS (TAXAS + GATEWAY)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  sale_fee_pct NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
  processing_fee_fixed NUMERIC(10, 2) NOT NULL DEFAULT 2.00,
  swap_guarantee_fee_fixed NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
  swap_guarantee_portal_pct NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
  gateway_provider TEXT NOT NULL DEFAULT 'stripe',
  gateway_mode TEXT NOT NULL DEFAULT 'sandbox' CHECK (gateway_mode IN ('sandbox', 'production')),
  gateway_key_sandbox TEXT,
  gateway_key_production TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

INSERT INTO public.platform_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 2) TRANSACTIONS: NOVAS COLUNAS DE TAXAS E TIPO
-- =============================================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS transaction_type TEXT NOT NULL DEFAULT 'venda'
    CHECK (transaction_type IN ('venda', 'troca')),
  ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gateway_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_transactions_type
  ON public.transactions(transaction_type);

-- =============================================================================
-- 3) USER BALANCES: SALDO DISPONIVEL / PENDENTE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_balances (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  available_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  pending_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_balances_updated
  ON public.user_balances(updated_at DESC);

-- =============================================================================
-- 4) SWAPS: PERMUTAS COM GARANTIA
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.swaps (
  swap_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_1_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_2_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_1_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  item_2_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  guarantee_fee_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  guarantee_fee_1_paid BOOLEAN NOT NULL DEFAULT false,
  guarantee_fee_2_paid BOOLEAN NOT NULL DEFAULT false,
  user_1_confirmed BOOLEAN NOT NULL DEFAULT false,
  user_2_confirmed BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'aguardando_taxas'
    CHECK (status IN ('aguardando_taxas', 'autorizado_envio', 'em_troca', 'concluido', 'cancelado')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  authorized_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_swaps_users
  ON public.swaps(user_1_id, user_2_id);

CREATE INDEX IF NOT EXISTS idx_swaps_status
  ON public.swaps(status);

-- =============================================================================
-- 5) LEDGER UNIFICADO (AUDITORIA)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.financial_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('venda', 'troca', 'ajuste')),
  source_id UUID,
  entry_type TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ledger_source
  ON public.financial_ledger(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_ledger_user
  ON public.financial_ledger(user_id);

CREATE INDEX IF NOT EXISTS idx_ledger_created
  ON public.financial_ledger(created_at DESC);

-- =============================================================================
-- 6) FUNCOES AUXILIARES
-- =============================================================================
CREATE OR REPLACE FUNCTION ensure_user_balance(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.user_balances (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION validate_user_documents(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_profile RECORD;
BEGIN
  SELECT cpf_cnpj, rg INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_profile.cpf_cnpj IS NULL OR v_profile.cpf_cnpj = '' THEN
    RAISE EXCEPTION 'CPF/CNPJ nao validado para o usuario %', p_user_id;
  END IF;

  IF v_profile.rg IS NULL OR v_profile.rg = '' THEN
    RAISE EXCEPTION 'RG nao validado para o usuario %', p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION apply_transaction_fees()
RETURNS TRIGGER AS $$
DECLARE
  v_settings RECORD;
  v_platform_fee NUMERIC(10, 2);
  v_gateway_fee NUMERIC(10, 2);
BEGIN
  SELECT * INTO v_settings FROM public.platform_settings WHERE id = 1;

  v_platform_fee := ROUND((NEW.price * v_settings.sale_fee_pct) / 100, 2);
  v_gateway_fee := COALESCE(v_settings.processing_fee_fixed, 0);

  NEW.platform_fee := COALESCE(NEW.platform_fee, v_platform_fee);
  NEW.gateway_fee := COALESCE(NEW.gateway_fee, v_gateway_fee);
  NEW.net_amount := NEW.price - NEW.platform_fee - NEW.gateway_fee;
  NEW.total_amount := NEW.price + NEW.platform_fee + NEW.gateway_fee;

  IF NEW.net_amount < 0 THEN
    RAISE EXCEPTION 'Valor liquido negativo para transacao %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION validate_transaction_profiles()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM validate_user_documents(NEW.buyer_id);
  PERFORM validate_user_documents(NEW.seller_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION handle_transaction_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Entrada em custodia (pagamento confirmado)
  IF NEW.status = 'pago' AND OLD.status = 'pendente' THEN
    PERFORM ensure_user_balance(NEW.seller_id);

    UPDATE public.user_balances
    SET pending_balance = pending_balance + NEW.net_amount,
        updated_at = NOW()
    WHERE user_id = NEW.seller_id;

    INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, metadata)
    VALUES ('venda', NEW.id, 'custodia_entrada', NEW.total_amount,
      jsonb_build_object('status_from', OLD.status, 'status_to', NEW.status));

    INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, user_id, metadata)
    VALUES ('venda', NEW.id, 'saldo_pendente', NEW.net_amount, NEW.seller_id,
      jsonb_build_object('status_from', OLD.status, 'status_to', NEW.status));
  END IF;

  -- Liberacao ao vendedor (conclusao)
  IF NEW.status = 'concluido' AND OLD.status IN ('pago', 'enviado') THEN
    PERFORM ensure_user_balance(NEW.seller_id);

    UPDATE public.user_balances
    SET pending_balance = GREATEST(pending_balance - NEW.net_amount, 0),
        available_balance = available_balance + NEW.net_amount,
        updated_at = NOW()
    WHERE user_id = NEW.seller_id;

    INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, metadata)
    VALUES ('venda', NEW.id, 'custodia_saida', NEW.total_amount,
      jsonb_build_object('status_from', OLD.status, 'status_to', NEW.status));

    INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, user_id, metadata)
    VALUES ('venda', NEW.id, 'saldo_disponivel', NEW.net_amount, NEW.seller_id,
      jsonb_build_object('status_from', OLD.status, 'status_to', NEW.status));

    INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, metadata)
    VALUES ('venda', NEW.id, 'taxa_plataforma', NEW.platform_fee,
      jsonb_build_object('status_from', OLD.status, 'status_to', NEW.status));

    INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, metadata)
    VALUES ('venda', NEW.id, 'taxa_gateway', NEW.gateway_fee,
      jsonb_build_object('status_from', OLD.status, 'status_to', NEW.status));
  END IF;

  -- Cancelamento antes da conclusao
  IF NEW.status = 'cancelado' AND OLD.status IN ('pago', 'enviado') THEN
    PERFORM ensure_user_balance(NEW.seller_id);

    UPDATE public.user_balances
    SET pending_balance = GREATEST(pending_balance - NEW.net_amount, 0),
        updated_at = NOW()
    WHERE user_id = NEW.seller_id;

    INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, metadata)
    VALUES ('venda', NEW.id, 'custodia_saida', NEW.total_amount,
      jsonb_build_object('status_from', OLD.status, 'status_to', NEW.status, 'motivo', 'cancelamento'));

    INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, user_id, metadata)
    VALUES ('venda', NEW.id, 'reembolso', NEW.total_amount, NEW.buyer_id,
      jsonb_build_object('status_from', OLD.status, 'status_to', NEW.status));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 7) FUNCOES: SWAP ESCROW
-- =============================================================================
CREATE OR REPLACE FUNCTION pay_swap_guarantee(p_swap_id UUID)
RETURNS JSON AS $$
DECLARE
  v_swap RECORD;
  v_settings RECORD;
  v_is_user1 BOOLEAN;
BEGIN
  SELECT * INTO v_swap FROM public.swaps WHERE swap_id = p_swap_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Swap nao encontrado');
  END IF;

  IF auth.uid() NOT IN (v_swap.user_1_id, v_swap.user_2_id) THEN
    RETURN json_build_object('success', false, 'message', 'Usuario nao autorizado');
  END IF;

  PERFORM validate_user_documents(auth.uid());

  SELECT * INTO v_settings FROM public.platform_settings WHERE id = 1;
  IF v_swap.guarantee_fee_amount = 0 THEN
    v_swap.guarantee_fee_amount := v_settings.swap_guarantee_fee_fixed;
  END IF;

  v_is_user1 := (auth.uid() = v_swap.user_1_id);

  IF v_is_user1 AND v_swap.guarantee_fee_1_paid THEN
    RETURN json_build_object('success', false, 'message', 'Taxa ja paga por este usuario');
  END IF;

  IF (NOT v_is_user1) AND v_swap.guarantee_fee_2_paid THEN
    RETURN json_build_object('success', false, 'message', 'Taxa ja paga por este usuario');
  END IF;

  UPDATE public.swaps
  SET guarantee_fee_amount = v_swap.guarantee_fee_amount,
      guarantee_fee_1_paid = CASE WHEN v_is_user1 THEN true ELSE guarantee_fee_1_paid END,
      guarantee_fee_2_paid = CASE WHEN v_is_user1 THEN guarantee_fee_2_paid ELSE true END,
      status = CASE WHEN (v_is_user1 AND guarantee_fee_2_paid) OR ((NOT v_is_user1) AND guarantee_fee_1_paid)
        THEN 'autorizado_envio' ELSE status END,
      authorized_at = CASE WHEN (v_is_user1 AND guarantee_fee_2_paid) OR ((NOT v_is_user1) AND guarantee_fee_1_paid)
        THEN NOW() ELSE authorized_at END,
      updated_at = NOW()
  WHERE swap_id = p_swap_id;

  INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, user_id, metadata)
  VALUES ('troca', p_swap_id, 'custodia_entrada', v_swap.guarantee_fee_amount, auth.uid(),
    jsonb_build_object('evento', 'taxa_garantia'));

  RETURN json_build_object('success', true, 'message', 'Taxa de garantia em custodia');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION confirm_swap_receipt(p_swap_id UUID)
RETURNS JSON AS $$
DECLARE
  v_swap RECORD;
  v_settings RECORD;
  v_keep_pct NUMERIC(5, 2);
  v_keep_amount NUMERIC(10, 2);
  v_refund_amount NUMERIC(10, 2);
BEGIN
  SELECT * INTO v_swap FROM public.swaps WHERE swap_id = p_swap_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Swap nao encontrado');
  END IF;

  IF auth.uid() NOT IN (v_swap.user_1_id, v_swap.user_2_id) THEN
    RETURN json_build_object('success', false, 'message', 'Usuario nao autorizado');
  END IF;

  IF v_swap.status NOT IN ('autorizado_envio', 'em_troca') THEN
    RETURN json_build_object('success', false, 'message', 'Swap nao esta pronto para confirmar');
  END IF;

  UPDATE public.swaps
  SET user_1_confirmed = CASE WHEN auth.uid() = v_swap.user_1_id THEN true ELSE user_1_confirmed END,
      user_2_confirmed = CASE WHEN auth.uid() = v_swap.user_2_id THEN true ELSE user_2_confirmed END,
      status = CASE WHEN (user_1_confirmed OR auth.uid() = v_swap.user_1_id)
                        AND (user_2_confirmed OR auth.uid() = v_swap.user_2_id)
                    THEN 'concluido' ELSE status END,
      completed_at = CASE WHEN (user_1_confirmed OR auth.uid() = v_swap.user_1_id)
                              AND (user_2_confirmed OR auth.uid() = v_swap.user_2_id)
                          THEN NOW() ELSE completed_at END,
      updated_at = NOW()
  WHERE swap_id = p_swap_id
  RETURNING * INTO v_swap;

  IF v_swap.status = 'concluido' THEN
    SELECT * INTO v_settings FROM public.platform_settings WHERE id = 1;
    v_keep_pct := COALESCE(v_settings.swap_guarantee_portal_pct, 100);

    v_keep_amount := ROUND((v_swap.guarantee_fee_amount * 2) * (v_keep_pct / 100), 2);
    v_refund_amount := (v_swap.guarantee_fee_amount * 2) - v_keep_amount;

    IF v_keep_amount > 0 THEN
      INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, metadata)
      VALUES ('troca', p_swap_id, 'taxa_plataforma', v_keep_amount,
        jsonb_build_object('evento', 'swap_concluido', 'pct', v_keep_pct));
    END IF;

    IF v_refund_amount > 0 THEN
      INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, metadata)
      VALUES ('troca', p_swap_id, 'custodia_saida', v_refund_amount,
        jsonb_build_object('evento', 'swap_concluido', 'reembolso_total', v_refund_amount));
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'message', 'Confirmacao registrada');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 8) TRIGGERS
-- =============================================================================
DROP TRIGGER IF EXISTS trg_apply_transaction_fees ON public.transactions;
CREATE TRIGGER trg_apply_transaction_fees
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION apply_transaction_fees();

DROP TRIGGER IF EXISTS trg_validate_transaction_profiles ON public.transactions;
CREATE TRIGGER trg_validate_transaction_profiles
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION validate_transaction_profiles();

DROP TRIGGER IF EXISTS trg_handle_transaction_status ON public.transactions;
CREATE TRIGGER trg_handle_transaction_status
  AFTER UPDATE OF status ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION handle_transaction_status_change();

-- =============================================================================
-- 9) RLS POLICIES
-- =============================================================================
ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_ledger ENABLE ROW LEVEL SECURITY;

-- User balances: usuario ve apenas o proprio saldo
DROP POLICY IF EXISTS "Usuarios veem seu saldo" ON public.user_balances;
CREATE POLICY "Usuarios veem seu saldo"
  ON public.user_balances
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins podem ver todos os saldos
DROP POLICY IF EXISTS "Admins veem saldos" ON public.user_balances;
CREATE POLICY "Admins veem saldos"
  ON public.user_balances
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  ));

-- Platform settings: apenas admin
DROP POLICY IF EXISTS "Admins veem settings" ON public.platform_settings;
CREATE POLICY "Admins veem settings"
  ON public.platform_settings
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  ));

DROP POLICY IF EXISTS "Admins atualizam settings" ON public.platform_settings;
CREATE POLICY "Admins atualizam settings"
  ON public.platform_settings
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  ));

-- Swaps: apenas participantes
DROP POLICY IF EXISTS "Participantes veem swaps" ON public.swaps;
CREATE POLICY "Participantes veem swaps"
  ON public.swaps
  FOR SELECT
  USING (auth.uid() = user_1_id OR auth.uid() = user_2_id);

DROP POLICY IF EXISTS "Participantes criam swaps" ON public.swaps;
CREATE POLICY "Participantes criam swaps"
  ON public.swaps
  FOR INSERT
  WITH CHECK (auth.uid() = user_1_id OR auth.uid() = user_2_id);

DROP POLICY IF EXISTS "Participantes atualizam swaps" ON public.swaps;
CREATE POLICY "Participantes atualizam swaps"
  ON public.swaps
  FOR UPDATE
  USING (auth.uid() = user_1_id OR auth.uid() = user_2_id);

-- Ledger: apenas admin
DROP POLICY IF EXISTS "Admins veem ledger" ON public.financial_ledger;
CREATE POLICY "Admins veem ledger"
  ON public.financial_ledger
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  ));

-- =============================================================================
-- 10) CHECK FINAL
-- =============================================================================
SELECT '✅ Banco virtual criado com sucesso' AS status;

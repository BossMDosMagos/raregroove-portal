-- =============================================================================
-- BACKFILL AUTOMATICO - TRANSACOES EXISTENTES
-- Data: 25/02/2026
-- =============================================================================
-- Objetivo:
-- 1) Atualizar transacoes antigas com as novas colunas de taxas
-- 2) Recalcular platform_fee, gateway_fee, net_amount, total_amount
-- 3) Sincronizar user_balances com transacoes concluidas
-- 4) Gerar entradas retroativas no financial_ledger (opcional)
-- =============================================================================

-- =============================================================================
-- 1) VERIFICAR SE HÁ TRANSACOES PARA ATUALIZAR
-- =============================================================================
DO $$
DECLARE
  v_count_to_update INT;
  v_settings RECORD;
  v_transaction RECORD;
  v_platform_fee NUMERIC(10, 2);
  v_gateway_fee NUMERIC(10, 2);
  v_net_amount NUMERIC(10, 2);
  v_total_amount NUMERIC(10, 2);
BEGIN
  -- Buscar configuracoes atuais
  SELECT * INTO v_settings FROM public.platform_settings WHERE id = 1;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Platform settings nao encontrado. Execute SQL-BANCO-VIRTUAL-FINANCEIRO.sql primeiro.';
    RETURN;
  END IF;

  -- Contar transacoes que precisam de backfill
  SELECT COUNT(*) INTO v_count_to_update
  FROM public.transactions
  WHERE platform_fee = 0 OR platform_fee IS NULL
     OR gateway_fee = 0 OR gateway_fee IS NULL
     OR net_amount = 0 OR net_amount IS NULL
     OR total_amount = 0 OR total_amount IS NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Transacoes a atualizar: %', v_count_to_update;
  RAISE NOTICE '========================================';

  IF v_count_to_update = 0 THEN
    RAISE NOTICE 'Nenhuma transacao precisa de backfill. Sistema ja esta atualizado.';
    RETURN;
  END IF;

  -- =============================================================================
  -- 2) ATUALIZAR TRANSACOES (CALCULO DE TAXAS)
  -- =============================================================================
  FOR v_transaction IN
    SELECT *
    FROM public.transactions
    WHERE platform_fee = 0 OR platform_fee IS NULL
       OR gateway_fee = 0 OR gateway_fee IS NULL
       OR net_amount = 0 OR net_amount IS NULL
       OR total_amount = 0 OR total_amount IS NULL
  LOOP
    -- Calcular taxas baseado no price
    v_platform_fee := ROUND((v_transaction.price * v_settings.sale_fee_pct) / 100, 2);
    v_gateway_fee := COALESCE(v_settings.processing_fee_fixed, 0);
    v_net_amount := v_transaction.price - v_platform_fee - v_gateway_fee;
    v_total_amount := v_transaction.price + v_platform_fee + v_gateway_fee;

    -- Atualizar transacao
    UPDATE public.transactions
    SET platform_fee = v_platform_fee,
        gateway_fee = v_gateway_fee,
        net_amount = v_net_amount,
        total_amount = v_total_amount,
        transaction_type = COALESCE(transaction_type, 'venda')
    WHERE id = v_transaction.id;

    RAISE NOTICE 'Transacao % atualizada: R$ % | Taxa: R$ % | Gateway: R$ % | Liquido: R$ %', 
      v_transaction.id, v_transaction.price, v_platform_fee, v_gateway_fee, v_net_amount;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'BACKFILL DE TAXAS CONCLUIDO';
  RAISE NOTICE '========================================';

  -- =============================================================================
  -- 3) SINCRONIZAR USER_BALANCES (TRANSACOES CONCLUIDAS)
  -- =============================================================================
  RAISE NOTICE 'Sincronizando user_balances...';

  -- Garantir que todos os vendedores tenham registro em user_balances
  INSERT INTO public.user_balances (user_id, available_balance, pending_balance)
  SELECT DISTINCT seller_id, 0, 0
  FROM public.transactions
  WHERE seller_id IS NOT NULL
  ON CONFLICT (user_id) DO NOTHING;

  -- Calcular saldo disponivel (transacoes concluidas)
  FOR v_transaction IN
    SELECT id, seller_id, net_amount, status
    FROM public.transactions
    WHERE status = 'concluido'
      AND seller_id IS NOT NULL
  LOOP
    -- Atualizar saldo disponivel do vendedor
    UPDATE public.user_balances
    SET available_balance = available_balance + v_transaction.net_amount,
        updated_at = NOW()
    WHERE user_id = v_transaction.seller_id;

    RAISE NOTICE 'Saldo atualizado para seller %: +R$ %', 
      v_transaction.seller_id, v_transaction.net_amount;
  END LOOP;

  -- Calcular saldo pendente (transacoes pagas mas nao concluidas)
  FOR v_transaction IN
    SELECT id, seller_id, net_amount, status
    FROM public.transactions
    WHERE status IN ('pago', 'pago_custodia', 'enviado')
      AND seller_id IS NOT NULL
  LOOP
    -- Atualizar saldo pendente do vendedor
    UPDATE public.user_balances
    SET pending_balance = pending_balance + v_transaction.net_amount,
        updated_at = NOW()
    WHERE user_id = v_transaction.seller_id;

    RAISE NOTICE 'Saldo pendente atualizado para seller %: +R$ %', 
      v_transaction.seller_id, v_transaction.net_amount;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'SINCRONIZACAO DE SALDOS CONCLUIDA';
  RAISE NOTICE '========================================';

  -- =============================================================================
  -- 4) GERAR ENTRADAS NO LEDGER (OPCIONAL - SOMENTE TRANSACOES CONCLUIDAS)
  -- =============================================================================
  RAISE NOTICE 'Gerando entradas retroativas no financial_ledger...';

  FOR v_transaction IN
    SELECT id, seller_id, buyer_id, net_amount, platform_fee, gateway_fee, total_amount, status
    FROM public.transactions
    WHERE status = 'concluido'
      AND NOT EXISTS (
        SELECT 1 FROM public.financial_ledger
        WHERE source_type = 'venda' AND source_id = transactions.id
      )
  LOOP
    -- Entrada em custodia
    INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, metadata)
    VALUES ('venda', v_transaction.id, 'custodia_entrada', v_transaction.total_amount,
      jsonb_build_object('evento', 'backfill_retroativo', 'status', v_transaction.status));

    -- Saida de custodia
    INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, metadata)
    VALUES ('venda', v_transaction.id, 'custodia_saida', v_transaction.total_amount,
      jsonb_build_object('evento', 'backfill_retroativo', 'status', v_transaction.status));

    -- Saldo disponivel vendedor
    INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, user_id, metadata)
    VALUES ('venda', v_transaction.id, 'saldo_disponivel', v_transaction.net_amount, v_transaction.seller_id,
      jsonb_build_object('evento', 'backfill_retroativo', 'status', v_transaction.status));

    -- Taxa plataforma
    INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, metadata)
    VALUES ('venda', v_transaction.id, 'taxa_plataforma', v_transaction.platform_fee,
      jsonb_build_object('evento', 'backfill_retroativo', 'status', v_transaction.status));

    -- Taxa gateway
    INSERT INTO public.financial_ledger (source_type, source_id, entry_type, amount, metadata)
    VALUES ('venda', v_transaction.id, 'taxa_gateway', v_transaction.gateway_fee,
      jsonb_build_object('evento', 'backfill_retroativo', 'status', v_transaction.status));

    RAISE NOTICE 'Ledger retroativo criado para transacao %', v_transaction.id;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'LEDGER RETROATIVO CONCLUIDO';
  RAISE NOTICE '========================================';

  -- =============================================================================
  -- 5) RELATORIO FINAL
  -- =============================================================================
  DECLARE
    v_total_transactions INT;
    v_total_concluidas INT;
    v_total_pendentes INT;
    v_total_revenue NUMERIC(12, 2);
    v_total_fees NUMERIC(12, 2);
  BEGIN
    SELECT COUNT(*) INTO v_total_transactions FROM public.transactions;
    SELECT COUNT(*) INTO v_total_concluidas FROM public.transactions WHERE status = 'concluido';
    SELECT COUNT(*) INTO v_total_pendentes FROM public.transactions WHERE status IN ('pago', 'pago_custodia', 'enviado');
    
    SELECT COALESCE(SUM(net_amount), 0) INTO v_total_revenue 
    FROM public.transactions WHERE status = 'concluido';
    
    SELECT COALESCE(SUM(platform_fee + gateway_fee), 0) INTO v_total_fees 
    FROM public.transactions WHERE status = 'concluido';

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '         RELATORIO FINAL';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total de transacoes: %', v_total_transactions;
    RAISE NOTICE 'Transacoes concluidas: %', v_total_concluidas;
    RAISE NOTICE 'Transacoes pendentes: %', v_total_pendentes;
    RAISE NOTICE 'Receita total (liquida): R$ %', v_total_revenue;
    RAISE NOTICE 'Taxas arrecadadas: R$ %', v_total_fees;
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ BACKFILL COMPLETO CONCLUIDO';
    RAISE NOTICE '========================================';
  END;
END $$;

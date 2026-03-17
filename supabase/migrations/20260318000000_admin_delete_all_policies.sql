-- Admin Delete Policies - Dando poder total ao admin para deletar qualquer registro
-- Execute este script no SQL Editor do Supabase

-- Verificar se a tabela existe antes de criar a política
DO $$
BEGIN
  -- Disputes - Admin pode deletar qualquer disputa
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'disputes') THEN
    DROP POLICY IF EXISTS "Admin delete disputes" ON public.disputes;
    CREATE POLICY "Admin delete disputes"
    ON public.disputes
    FOR DELETE
    USING (public.is_admin_user(auth.uid()));
  END IF;

  -- Dispute Messages
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dispute_messages') THEN
    DROP POLICY IF EXISTS "Admin delete dispute_messages" ON public.dispute_messages;
    CREATE POLICY "Admin delete dispute_messages"
    ON public.dispute_messages
    FOR DELETE
    USING (public.is_admin_user(auth.uid()));
  END IF;

  -- Dispute Evidence
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dispute_evidence') THEN
    DROP POLICY IF EXISTS "Admin delete dispute_evidence" ON public.dispute_evidence;
    CREATE POLICY "Admin delete dispute_evidence"
    ON public.dispute_evidence
    FOR DELETE
    USING (public.is_admin_user(auth.uid()));
  END IF;

  -- Dispute Refund Tasks
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dispute_refund_tasks') THEN
    DROP POLICY IF EXISTS "Admin delete dispute_refund_tasks" ON public.dispute_refund_tasks;
    CREATE POLICY "Admin delete dispute_refund_tasks"
    ON public.dispute_refund_tasks
    FOR DELETE
    USING (public.is_admin_user(auth.uid()));
  END IF;

  -- User Addresses
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_addresses') THEN
    DROP POLICY IF EXISTS "Admin delete user_addresses" ON public.user_addresses;
    CREATE POLICY "Admin delete user_addresses"
    ON public.user_addresses
    FOR DELETE
    USING (public.is_admin_user(auth.uid()));
  END IF;

  -- Reviews
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reviews') THEN
    DROP POLICY IF EXISTS "Admin delete reviews" ON public.reviews;
    CREATE POLICY "Admin delete reviews"
    ON public.reviews
    FOR DELETE
    USING (public.is_admin_user(auth.uid()));
  END IF;

  -- Notifications
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    DROP POLICY IF EXISTS "Admin delete notifications" ON public.notifications;
    CREATE POLICY "Admin delete notifications"
    ON public.notifications
    FOR DELETE
    USING (public.is_admin_user(auth.uid()));
  END IF;

  -- Archived Conversations - apenas se existir
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'archived_conversations') THEN
    DROP POLICY IF EXISTS "Admin delete archived_conversations" ON public.archived_conversations;
    CREATE POLICY "Admin delete archived_conversations"
    ON public.archived_conversations
    FOR DELETE
    USING (public.is_admin_user(auth.uid()));
  END IF;

  -- Messages
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages') THEN
    DROP POLICY IF EXISTS "Admin delete messages" ON public.messages;
    CREATE POLICY "Admin delete messages"
    ON public.messages
    FOR DELETE
    USING (public.is_admin_user(auth.uid()));
  END IF;

  -- Wishlist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wishlist') THEN
    DROP POLICY IF EXISTS "Admin delete wishlist" ON public.wishlist;
    CREATE POLICY "Admin delete wishlist"
    ON public.wishlist
    FOR DELETE
    USING (public.is_admin_user(auth.uid()));
  END IF;

  -- Shipping
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shipping') THEN
    DROP POLICY IF EXISTS "Admin delete shipping" ON public.shipping;
    CREATE POLICY "Admin delete shipping"
    ON public.shipping
    FOR DELETE
    USING (public.is_admin_user(auth.uid()));
  END IF;

  -- Shipping Labels
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shipping_labels') THEN
    DROP POLICY IF EXISTS "Admin delete shipping_labels" ON public.shipping_labels;
    CREATE POLICY "Admin delete shipping_labels"
    ON public.shipping_labels
    FOR DELETE
    USING (public.is_admin_user(auth.uid()));
  END IF;

  -- Webhook Logs
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'webhook_logs') THEN
    DROP POLICY IF EXISTS "Admin delete webhook_logs" ON public.webhook_logs;
    CREATE POLICY "Admin delete webhook_logs"
    ON public.webhook_logs
    FOR DELETE
    USING (public.is_admin_user(auth.uid()));
  END IF;

  -- Site Stats
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'site_stats') THEN
    DROP POLICY IF EXISTS "Admin delete site_stats" ON public.site_stats;
    CREATE POLICY "Admin delete site_stats"
    ON public.site_stats
    FOR DELETE
    USING (public.is_admin_user(auth.uid()));
  END IF;

  -- Subscriptions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions') THEN
    DROP POLICY IF EXISTS "Admin delete subscriptions" ON public.subscriptions;
    CREATE POLICY "Admin delete subscriptions"
    ON public.subscriptions
    FOR DELETE
    USING (public.is_admin_user(auth.uid()));
  END IF;

  -- Subscription Plans
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription_plans') THEN
    DROP POLICY IF EXISTS "Admin delete subscription_plans" ON public.subscription_plans;
    CREATE POLICY "Admin delete subscription_plans"
    ON public.subscription_plans
    FOR DELETE
    USING (public.is_admin_user(auth.uid()));
  END IF;

  -- User Balances
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_balances') THEN
    DROP POLICY IF EXISTS "Admin delete user_balances" ON public.user_balances;
    CREATE POLICY "Admin delete user_balances"
    ON public.user_balances
    FOR DELETE
    USING (public.is_admin_user(auth.uid()));
  END IF;

  -- Escrow SLA Events
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'escrow_sla_events') THEN
    DROP POLICY IF EXISTS "Admin delete escrow_sla_events" ON public.escrow_sla_events;
    CREATE POLICY "Admin delete escrow_sla_events"
    ON public.escrow_sla_events
    FOR DELETE
    USING (public.is_admin_user(auth.uid()));
  END IF;

  -- Withdrawals
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'withdrawals') THEN
    DROP POLICY IF EXISTS "Admin delete withdrawals" ON public.withdrawals;
    CREATE POLICY "Admin delete withdrawals"
    ON public.withdrawals
    FOR DELETE
    USING (public.is_admin_user(auth.uid()));
  END IF;

  -- Financial Ledger
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_ledger') THEN
    DROP POLICY IF EXISTS "Admin delete financial_ledger" ON public.financial_ledger;
    CREATE POLICY "Admin delete financial_ledger"
    ON public.financial_ledger
    FOR DELETE
    USING (public.is_admin_user(auth.uid()));
  END IF;

  -- Transactions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    DROP POLICY IF EXISTS "Admin delete transactions" ON public.transactions;
    CREATE POLICY "Admin delete transactions"
    ON public.transactions
    FOR DELETE
    USING (public.is_admin_user(auth.uid()));
  END IF;

  -- Swaps
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'swaps') THEN
    DROP POLICY IF EXISTS "Admin delete swaps" ON public.swaps;
    CREATE POLICY "Admin delete swaps"
    ON public.swaps
    FOR DELETE
    USING (public.is_admin_user(auth.uid()));
  END IF;

  -- Items
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'items') THEN
    DROP POLICY IF EXISTS "Admin delete items" ON public.items;
    CREATE POLICY "Admin delete items"
    ON public.items
    FOR DELETE
    USING (public.is_admin_user(auth.uid()));
  END IF;

  RAISE NOTICE 'Admin delete policies created successfully!';
END $$;
-- Admin Delete Policies - Dando poder total ao admin para deletar qualquer registro

-- Disputes - Admin pode deletar qualquer disputa
DROP POLICY IF EXISTS "Admin delete disputes" ON public.disputes;
CREATE POLICY "Admin delete disputes"
ON public.disputes
FOR DELETE
USING (public.is_admin_user(auth.uid()));

-- Dispute Messages - Admin pode deletar qualquer mensagem de disputa
DROP POLICY IF EXISTS "Admin delete dispute_messages" ON public.dispute_messages;
CREATE POLICY "Admin delete dispute_messages"
ON public.dispute_messages
FOR DELETE
USING (public.is_admin_user(auth.uid()));

-- Dispute Evidence - Admin pode deletar qualquer evidência
DROP POLICY IF EXISTS "Admin delete dispute_evidence" ON public.dispute_evidence;
CREATE POLICY "Admin delete dispute_evidence"
ON public.dispute_evidence
FOR DELETE
USING (public.is_admin_user(auth.uid()));

-- Dispute Refund Tasks - Admin pode deletar qualquer task de refund
DROP POLICY IF EXISTS "Admin delete dispute_refund_tasks" ON public.dispute_refund_tasks;
CREATE POLICY "Admin delete dispute_refund_tasks"
ON public.dispute_refund_tasks
FOR DELETE
USING (public.is_admin_user(auth.uid()));

-- User Addresses - Admin pode deletar qualquer endereço
DROP POLICY IF EXISTS "Admin delete user_addresses" ON public.user_addresses;
CREATE POLICY "Admin delete user_addresses"
ON public.user_addresses
FOR DELETE
USING (public.is_admin_user(auth.uid()));

-- Reviews - Admin pode deletar qualquer avaliação
DROP POLICY IF EXISTS "Admin delete reviews" ON public.reviews;
CREATE POLICY "Admin delete reviews"
ON public.reviews
FOR DELETE
USING (public.is_admin_user(auth.uid()));

-- Notifications - Admin pode deletar qualquer notificação
DROP POLICY IF EXISTS "Admin delete notifications" ON public.notifications;
CREATE POLICY "Admin delete notifications"
ON public.notifications
FOR DELETE
USING (public.is_admin_user(auth.uid()));

-- Archived Conversations - Admin pode deletar qualquer conversa arquivada
DROP POLICY IF EXISTS "Admin delete archived_conversations" ON public.archived_conversations;
CREATE POLICY "Admin delete archived_conversations"
ON public.archived_conversations
FOR DELETE
USING (public.is_admin_user(auth.uid()));

-- Messages - Admin pode deletar qualquer mensagem
DROP POLICY IF EXISTS "Admin delete messages" ON public.messages;
CREATE POLICY "Admin delete messages"
ON public.messages
FOR DELETE
USING (public.is_admin_user(auth.uid()));

-- Wishlist - Admin pode deletar qualquer item da wishlist
DROP POLICY IF EXISTS "Admin delete wishlist" ON public.wishlist;
CREATE POLICY "Admin delete wishlist"
ON public.wishlist
FOR DELETE
USING (public.is_admin_user(auth.uid()));

-- Shipping - Admin pode deletar qualquer registro de shipping
DROP POLICY IF EXISTS "Admin delete shipping" ON public.shipping;
CREATE POLICY "Admin delete shipping"
ON public.shipping
FOR DELETE
USING (public.is_admin_user(auth.uid()));

-- Shipping Labels - Admin pode deletar qualquer label
DROP POLICY IF EXISTS "Admin delete shipping_labels" ON public.shipping_labels;
CREATE POLICY "Admin delete shipping_labels"
ON public.shipping_labels
FOR DELETE
USING (public.is_admin_user(auth.uid()));

-- Webhook Logs - Admin pode deletar logs de webhook
DROP POLICY IF EXISTS "Admin delete webhook_logs" ON public.webhook_logs;
CREATE POLICY "Admin delete webhook_logs"
ON public.webhook_logs
FOR DELETE
USING (public.is_admin_user(auth.uid()));

-- Site Stats - Admin pode deletar estatísticas
DROP POLICY IF EXISTS "Admin delete site_stats" ON public.site_stats;
CREATE POLICY "Admin delete site_stats"
ON public.site_stats
FOR DELETE
USING (public.is_admin_user(auth.uid()));

-- Subscriptions - Admin pode deletar assinaturas
DROP POLICY IF EXISTS "Admin delete subscriptions" ON public.subscriptions;
CREATE POLICY "Admin delete subscriptions"
ON public.subscriptions
FOR DELETE
USING (public.is_admin_user(auth.uid()));

-- Subscription Plans - Admin pode deletar planos
DROP POLICY IF EXISTS "Admin delete subscription_plans" ON public.subscription_plans;
CREATE POLICY "Admin delete subscription_plans"
ON public.subscription_plans
FOR DELETE
USING (public.is_admin_user(auth.uid()));

-- User Balances - Admin pode deletar saldos
DROP POLICY IF EXISTS "Admin delete user_balances" ON public.user_balances;
CREATE POLICY "Admin delete user_balances"
ON public.user_balances
FOR DELETE
USING (public.is_admin_user(auth.uid()));

-- Message Reads - Admin pode deletar registros de leitura
DROP POLICY IF EXISTS "Admin delete message_reads" ON public.message_reads;
CREATE POLICY "Admin delete message_reads"
ON public.message_reads
FOR DELETE
USING (public.is_admin_user(auth.uid()));
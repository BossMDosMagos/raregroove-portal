-- Adicionar tipos de notificação
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN ('wishlist_match', 'transaction', 'review', 'message', 'system', 'comprovante_received', 'payment_approved')
);
-- Adicionar novos statuses para fluxo PIX
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_status_check CHECK (
  status IN ('pendente', 'pago', 'enviado', 'concluido', 'cancelado', 'waiting_approval', 'vendido')
);
-- Corrigir constraint da tabela transactions para aceitar 'venda_portal'
-- Problema: Edge function tenta inserir 'venda_portal' mas constraints só aceita 'venda' ou 'troca'

-- 1. Remover constraint existente
ALTER TABLE public.transactions 
DROP CONSTRAINT IF EXISTS transactions_transaction_type_check;

-- 2. Recriar constraint com novo valor aceito
ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_transaction_type_check 
CHECK (transaction_type IN ('venda', 'troca', 'venda_portal', 'swap_fee'));

-- 3. Corrigir também status se tiver 'pago_em_custodia'
ALTER TABLE public.transactions 
DROP CONSTRAINT IF EXISTS transactions_status_check;

ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_status_check 
CHECK (status IN ('pendente', 'pago', 'pago_em_custodia', 'enviado', 'concluido', 'cancelado'));

-- Confirmação
SELECT 'Constraints corrigidas com sucesso!' as resultado;

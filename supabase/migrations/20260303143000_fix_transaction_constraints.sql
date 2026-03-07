-- Migration: Fix transaction_type and seller_id constraints
-- Descrição: 
-- 1. Adicionar 'venda_portal' e 'swap_fee' como valores válidos de transaction_type
-- 2. Adicionar 'pago_em_custodia' como status válido
-- 3. Permitir seller_id NULL para vendas do portal

-- 1. Remover constraint existente de transaction_type
ALTER TABLE public.transactions 
DROP CONSTRAINT IF EXISTS transactions_transaction_type_check;

-- 2. Recriar constraint com novos valores aceitos
ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_transaction_type_check 
CHECK (transaction_type IN ('venda', 'troca', 'venda_portal', 'swap_fee'));

-- 3. Remover constraint existente de status
ALTER TABLE public.transactions 
DROP CONSTRAINT IF EXISTS transactions_status_check;

-- 4. Recriar constraint com novo status
ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_status_check 
CHECK (status IN ('pendente', 'pago', 'pago_em_custodia', 'enviado', 'concluido', 'cancelado'));

-- 5. Tornar seller_id nullable (para vendas do portal não precisam de vendedor específico)
ALTER TABLE public.transactions
ALTER COLUMN seller_id DROP NOT NULL;

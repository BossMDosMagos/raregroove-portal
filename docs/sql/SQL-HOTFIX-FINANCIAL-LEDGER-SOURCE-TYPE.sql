-- ============================================
-- HOTFIX: Adicionar 'saque' ao constraint de source_type
-- ============================================
-- Problema: financial_ledger.source_type constraint aceita apenas ('venda', 'troca', 'ajuste')
-- RPC tenta inserir 'saque', causando violação de constraint
-- Solução: Adicionar 'saque' aos valores permitidos
-- ============================================

-- Remover constraint antigo
ALTER TABLE public.financial_ledger
DROP CONSTRAINT "financial_ledger_source_type_check";

-- Adicionar novo constraint com 'saque'
ALTER TABLE public.financial_ledger
ADD CONSTRAINT financial_ledger_source_type_check 
CHECK (source_type IN ('venda', 'troca', 'ajuste', 'saque'));

-- Verificação
SELECT constraint_name, constraint_definition 
FROM information_schema.table_constraints
WHERE table_name = 'financial_ledger' AND constraint_type = 'CHECK';

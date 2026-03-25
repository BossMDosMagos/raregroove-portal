-- =============================================================================
-- FIX: ADICIONAR COLUNAS CPF_CNPJ E RG À TABELA PROFILES
-- Data: 25/02/2026
-- =============================================================================
-- Problema: O formulário CompleteSignUp tenta salvar em cpf_cnpj e rg,
-- mas a tabela profiles não tem essas colunas

-- SOLUÇÃO: Adicionar as colunas que faltam (com tratamento de erros)

-- 1. Adicionar coluna cpf_cnpj (unificada para CPF e CNPJ)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT UNIQUE;

-- 2. Adicionar coluna rg
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rg TEXT UNIQUE;

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_profiles_cpf_cnpj ON public.profiles(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_profiles_rg ON public.profiles(rg);

-- 4. Adicionar comentários
COMMENT ON COLUMN public.profiles.cpf_cnpj IS 'CPF (11 dígitos) ou CNPJ (14 dígitos) do usuário - SENSÍVEL - protegido por RLS';
COMMENT ON COLUMN public.profiles.rg IS 'RG do usuário - SENSÍVEL - protegido por RLS';

-- 5. Confirmação
SELECT '✅ Colunas cpf_cnpj e rg adicionadas à tabela profiles!' AS status;

-- =============================================================================
-- VERIFICAÇÃO: Ver estrutura atual da tabela profiles
-- =============================================================================
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;

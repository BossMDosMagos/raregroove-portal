-- ========================================
-- MIGRAÇÃO: UNIFICAR CPF PARA CPF_CNPJ
-- ========================================
-- Corrige duplicação de campos cpf/cpf_cnpj
-- Execute no Supabase SQL Editor

-- 1) Migrar dados de cpf para cpf_cnpj (se cpf_cnpj estiver vazio)
UPDATE public.profiles
SET cpf_cnpj = COALESCE(cpf_cnpj, cpf)
WHERE cpf_cnpj IS NULL OR cpf_cnpj = '';

-- 2) Remover coluna cpf antiga (se existir)
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS cpf CASCADE;

-- 3) Garantir que todos os campos necessários existem
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT,
  ADD COLUMN IF NOT EXISTS rg TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS number TEXT,
  ADD COLUMN IF NOT EXISTS complement TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS pix_key TEXT,
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspension_end TIMESTAMP WITH TIME ZONE;

-- 4) Recriar índices de unicidade
DROP INDEX IF EXISTS profiles_cpf_cnpj_unique;
CREATE UNIQUE INDEX profiles_cpf_cnpj_unique
  ON public.profiles (cpf_cnpj)
  WHERE cpf_cnpj IS NOT NULL AND cpf_cnpj <> '';

DROP INDEX IF EXISTS profiles_rg_unique;
CREATE UNIQUE INDEX profiles_rg_unique
  ON public.profiles (rg)
  WHERE rg IS NOT NULL AND rg <> '';

DROP INDEX IF EXISTS profiles_email_unique;
CREATE UNIQUE INDEX profiles_email_unique
  ON public.profiles (email);

-- 5) Verificação
SELECT 
  id, 
  email, 
  full_name,
  cpf_cnpj,
  rg,
  is_admin,
  status
FROM public.profiles
ORDER BY created_at DESC
LIMIT 10;

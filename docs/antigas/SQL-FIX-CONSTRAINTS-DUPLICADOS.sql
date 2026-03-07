-- ============================================================================
-- CORRIGIR: Constraints UNIQUE causando erro "DOCUMENTO DUPLICADO"
-- ============================================================================

-- 1. VERIFICAR constraints UNIQUE existentes
SELECT
  tc.constraint_name,
  kcu.column_name,
  tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'profiles'
  AND tc.constraint_type = 'UNIQUE'
ORDER BY tc.constraint_name;

-- 2. VERIFICAR duplicados de CPF/CNPJ
SELECT 
  cpf_cnpj,
  COUNT(*) as qtd,
  STRING_AGG(email, ' | ') as emails
FROM profiles
WHERE cpf_cnpj IS NOT NULL AND cpf_cnpj != ''
GROUP BY cpf_cnpj
HAVING COUNT(*) > 1;

-- 3. VERIFICAR duplicados de RG
SELECT 
  rg,
  COUNT(*) as qtd,
  STRING_AGG(email, ' | ') as emails
FROM profiles
WHERE rg IS NOT NULL AND rg != ''
GROUP BY rg
HAVING COUNT(*) > 1;

-- ============================================================================
-- SOLUÇÃO 1: REMOVER constraints UNIQUE que estão causando problema
-- (Execute apenas se as queries acima mostrarem constraints indesejadas)
-- ============================================================================

-- Remover constraint UNIQUE de cpf_cnpj (se existir)
-- ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_cpf_cnpj_key;

-- Remover constraint UNIQUE de rg (se existir)
-- ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_rg_key;

-- ============================================================================
-- SOLUÇÃO 2: LIMPAR perfis órfãos (sem dados completos)
-- (Execute apenas após confirmar que há perfis sem CPF/RG para limpar)
-- ============================================================================

-- Buscar perfis criados apenas pelo trigger (sem cpf_cnpj e rg)
-- SELECT 
--   id,
--   email,
--   full_name,
--   cpf_cnpj,
--   rg,
--   created_at
-- FROM profiles
-- WHERE (cpf_cnpj IS NULL OR cpf_cnpj = '')
--   AND (rg IS NULL OR rg = '')
--   AND created_at > NOW() - INTERVAL '7 days'
-- ORDER BY created_at DESC;

-- OPCIONAL: Deletar perfis órfãos (CUIDADO! Só execute se tiver certeza)
-- DELETE FROM profiles
-- WHERE (cpf_cnpj IS NULL OR cpf_cnpj = '')
--   AND (rg IS NULL OR rg = '')
--   AND created_at > NOW() - INTERVAL '7 days';

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

-- Contar perfis válidos vs órfãos
SELECT 
  CASE 
    WHEN cpf_cnpj IS NOT NULL AND cpf_cnpj != '' THEN 'COM CPF/CNPJ'
    ELSE 'SEM CPF/CNPJ'
  END as tipo,
  COUNT(*) as quantidade
FROM profiles
GROUP BY tipo;

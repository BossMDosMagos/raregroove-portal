-- ============================================================================
-- VERIFICAR: Nome correto do campo CPF na tabela profiles
-- ============================================================================

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'profiles'
AND (column_name LIKE '%cpf%' OR column_name LIKE '%cnpj%');

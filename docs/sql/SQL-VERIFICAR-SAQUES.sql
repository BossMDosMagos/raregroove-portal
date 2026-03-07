-- =====================================================================
-- VERIFICAR SAQUES NO BANCO
-- =====================================================================

-- 1. Ver todos os saques cadastrados
SELECT 
  w.id,
  w.user_id,
  w.amount,
  w.pix_key,
  w.status,
  w.requested_at,
  w.processed_at,
  w.notes,
  p.full_name,
  p.email
FROM withdrawals w
LEFT JOIN profiles p ON p.id = w.user_id
ORDER BY w.requested_at DESC;

-- 2. Contar saques por status
SELECT 
  status,
  COUNT(*) as quantidade,
  SUM(amount) as total_valor
FROM withdrawals
GROUP BY status
ORDER BY status;

-- 3. Verificar RLS da tabela withdrawals
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'withdrawals'
ORDER BY policyname;

-- 4. Verificar se usuário atual é admin
SELECT 
  id,
  full_name,
  email,
  is_admin
FROM profiles
WHERE id = auth.uid();

-- 5. Testar se consegue ver saques (executar como admin)
SELECT COUNT(*) as total_saques FROM withdrawals;

-- 6. Ver estrutura da tabela withdrawals
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'withdrawals'
ORDER BY ordinal_position;

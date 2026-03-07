-- ========================================
-- VERIFICAR REALTIME NO SUPABASE
-- Execute no SQL Editor
-- ========================================

-- 1. Verificar se tabela messages está na publication
SELECT 
  schemaname,
  tablename,
  'messages está na publication: ' || 
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM pg_publication_tables 
      WHERE schemaname = 'public' 
      AND tablename = 'messages' 
      AND pubname = 'supabase_realtime'
    ) THEN '✅ SIM'
    ELSE '❌ NÃO'
  END as realtime_status
FROM pg_tables
WHERE tablename = 'messages';

-- 2. Ver todas as tabelas com Realtime ativo
SELECT 
  tablename,
  '✅ Realtime ativo' as status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- 3. Se messages NÃO aparecer acima, execute isto:
-- ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- 4. Verificar políticas RLS (podem bloquear Realtime)
SELECT 
  policyname,
  cmd as tipo_comando,
  CASE cmd
    WHEN 'SELECT' THEN '✅ OK'
    WHEN 'INSERT' THEN '✅ OK'
    WHEN 'UPDATE' THEN '✅ OK'
    ELSE '⚠️ Revisar'
  END as status
FROM pg_policies
WHERE tablename = 'messages'
ORDER BY cmd;

-- 5. Testar INSERT manual (simular envio de mensagem)
-- IMPORTANTE: Substitua os valores abaixo:
-- - SENDER_USER_ID: ID do usuário que envia
-- - RECEIVER_USER_ID: ID do usuário que recebe
-- - ITEM_ID: ID de um item válido

/*
INSERT INTO messages (sender_id, receiver_id, item_id, content)
VALUES (
  'SENDER_USER_ID',
  'RECEIVER_USER_ID', 
  'ITEM_ID',
  'Teste de mensagem via SQL - ' || NOW()::text
)
RETURNING id, content, created_at;
*/

-- Se o INSERT acima funcionar e o sininho NÃO atualizar,
-- o problema É o Realtime que não está propagando

-- 6. Forçar rebuild da publication (último recurso)
/*
ALTER PUBLICATION supabase_realtime DROP TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
SELECT 'Realtime resetado para messages ✅';
*/

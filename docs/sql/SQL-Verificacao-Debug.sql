-- ========================================
-- VERIFICAÇÃO DO CAMPO read_at
-- ========================================

-- Execute este comando no Supabase SQL Editor para verificar
-- se o campo read_at existe na tabela messages

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'messages'
ORDER BY ordinal_position;

-- Se o campo read_at NÃO aparecer na lista acima, execute:
-- 1. Abra o arquivo SQL-Add-ReadAt-Messages.sql
-- 2. Copie todo o conteúdo
-- 3. Execute no SQL Editor

-- ========================================
-- VERIFICAR MENSAGENS NÃO LIDAS
-- ========================================

-- Ver todas as mensagens e seus status de leitura
-- SUBSTITUA 'SEU-USER-ID' pelo seu ID real (copie do console do navegador)

SELECT 
  id,
  content,
  sender_id,
  receiver_id,
  item_id,
  created_at,
  read_at,
  CASE 
    WHEN read_at IS NULL THEN '❌ NÃO LIDA'
    ELSE '✅ LIDA'
  END as status
FROM messages
WHERE receiver_id = 'SEU-USER-ID'
ORDER BY created_at DESC
LIMIT 20;

-- ========================================
-- TESTE MANUAL DE MARCAÇÃO DE LEITURA
-- ========================================

-- Se quiser testar manualmente marcar mensagens como lidas:
-- SUBSTITUA os valores abaixo

UPDATE messages
SET read_at = NOW()
WHERE receiver_id = 'SEU-USER-ID'
  AND item_id = 'SEU-ITEM-ID'
  AND read_at IS NULL
RETURNING id, content, read_at;

-- ========================================
-- VERIFICAR REALTIME REPLICATION
-- ========================================

-- No Supabase Dashboard:
-- 1. Vá em: Database → Replication
-- 2. Verifique se a tabela 'messages' está na lista
-- 3. Se não estiver, clique em "0 tables" e marque 'messages'
-- 4. Clique em Save

-- Para verificar via SQL se Realtime está ativo:
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM pg_publication_tables 
      WHERE schemaname = 'public' 
      AND tablename = 'messages'
    ) THEN '✅ REALTIME ATIVO'
    ELSE '❌ REALTIME INATIVO'
  END as realtime_status
FROM pg_tables
WHERE tablename = 'messages';

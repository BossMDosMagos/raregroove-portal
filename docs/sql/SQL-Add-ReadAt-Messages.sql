/*
╔═════════════════════════════════════════════════════════════════════════════════╗
║              ADICIONAR CAMPO read_at NA TABELA MESSAGES                         ║
║                Sistema de Rastreamento de Leitura de Mensagens                  ║
╚═════════════════════════════════════════════════════════════════════════════════╝

INSTRUÇÕES:
Execute este script no SQL Editor do Supabase para adicionar o campo read_at
na tabela messages (caso ainda não exista).

Este campo permite:
- Rastrear quando cada mensagem foi lida
- Calcular contador de mensagens não lidas
- Mostrar status de "lida/não lida" no chat

*/

-- ========================================
-- ADICIONAR COLUNA read_at NA TABELA messages
-- ========================================

-- Adicionar coluna read_at (apenas se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'messages' 
    AND column_name = 'read_at'
  ) THEN
    ALTER TABLE public.messages 
    ADD COLUMN read_at timestamp with time zone DEFAULT NULL;
    
    RAISE NOTICE 'Coluna read_at adicionada com sucesso!';
  ELSE
    RAISE NOTICE 'Coluna read_at já existe, nada a fazer.';
  END IF;
END $$;

/*
╔═════════════════════════════════════════════════════════════════════════════════╗
║                         COMO FUNCIONA                                           ║
╚═════════════════════════════════════════════════════════════════════════════════╝

1. Mensagens novas têm read_at = NULL (não lidas)

2. Quando o usuário abre uma conversa, o ChatThread executa:
   UPDATE messages 
   SET read_at = NOW() 
   WHERE receiver_id = [usuario_atual] 
   AND item_id = [item_da_conversa]
   AND read_at IS NULL

3. O contador de notificações conta apenas mensagens com read_at IS NULL

4. O contexto UnreadMessagesContext atualiza automaticamente via Realtime
   quando read_at é modificado

*/

-- Confirmação
SELECT 
  'Campo read_at configurado! ✅' as resultado,
  EXISTS(
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'messages' 
    AND column_name = 'read_at'
  ) as campo_existe;

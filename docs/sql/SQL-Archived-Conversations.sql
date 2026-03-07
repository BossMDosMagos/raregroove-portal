/*
╔═════════════════════════════════════════════════════════════════════════════════╗
║                    SISTEMA DE ARQUIVAR CONVERSAS                                ║
║                  Tabela: archived_conversations                                  ║
╚═════════════════════════════════════════════════════════════════════════════════╝

Execute este script no Supabase SQL Editor
*/

-- ========================================
-- CRIAR TABELA DE CONVERSAS ARQUIVADAS
-- ========================================

CREATE TABLE IF NOT EXISTS public.archived_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Evitar duplicatas (um usuário só pode arquivar a mesma conversa uma vez)
  UNIQUE(user_id, item_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_archived_user_id ON archived_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_archived_item_id ON archived_conversations(item_id);
CREATE INDEX IF NOT EXISTS idx_archived_user_item ON archived_conversations(user_id, item_id);

-- Habilitar RLS
ALTER TABLE public.archived_conversations ENABLE ROW LEVEL SECURITY;

-- ========================================
-- POLÍTICAS RLS
-- ========================================

-- SELECT: Usuários podem ver apenas seus próprios arquivamentos
CREATE POLICY "Users can view their own archived conversations"
ON archived_conversations FOR SELECT
USING (auth.uid() = user_id);

-- INSERT: Usuários podem arquivar conversas (sendo o user_id)
CREATE POLICY "Users can archive conversations"
ON archived_conversations FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- DELETE: Usuários podem desarquivar suas próprias conversas
CREATE POLICY "Users can unarchive conversations"
ON archived_conversations FOR DELETE
USING (auth.uid() = user_id);

-- ========================================
-- FUNÇÕES AUXILIARES
-- ========================================

-- Verificar se uma conversa está arquivada
CREATE OR REPLACE FUNCTION is_conversation_archived(p_user_id UUID, p_item_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM archived_conversations
    WHERE user_id = p_user_id AND item_id = p_item_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Contar conversas arquivadas de um usuário
CREATE OR REPLACE FUNCTION count_archived_conversations(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM archived_conversations
    WHERE user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- VERIFICAÇÃO
-- ========================================

SELECT 
  'Tabela archived_conversations criada! ✅' as status,
  COUNT(*) as total_registros
FROM archived_conversations;

SELECT 
  'Políticas RLS criadas: ' || COUNT(*)::text as policies
FROM pg_policies
WHERE tablename = 'archived_conversations';

/*
╔═════════════════════════════════════════════════════════════════════════════════╗
║                              COMO FUNCIONA                                      ║
╚═════════════════════════════════════════════════════════════════════════════════╝

1. ARQUIVAR CONVERSA:
   INSERT INTO archived_conversations (user_id, item_id)
   VALUES (auth.uid(), 'item-uuid');

2. DESARQUIVAR CONVERSA:
   DELETE FROM archived_conversations
   WHERE user_id = auth.uid() AND item_id = 'item-uuid';

3. LISTAR CONVERSAS NÃO ARQUIVADAS:
   SELECT * FROM messages
   WHERE item_id NOT IN (
     SELECT item_id FROM archived_conversations WHERE user_id = auth.uid()
   );

4. LISTAR CONVERSAS ARQUIVADAS:
   SELECT * FROM messages
   WHERE item_id IN (
     SELECT item_id FROM archived_conversations WHERE user_id = auth.uid()
   );

IMPORTANTE:
- Cada usuário arquiva independentemente (não afeta o outro)
- Mensagens NÃO são deletadas (ficam no banco)
- Pode desarquivar a qualquer momento
- UNIQUE constraint evita duplicatas

*/

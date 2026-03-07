-- ========================================
-- SISTEMA DE WISHLIST E NOTIFICAÇÕES - RAREGROOVE
-- ========================================
-- Sistema inteligente de desejos com match automático
-- e notificações quando itens raros aparecem

-- 1. Criar tabela de wishlist (desejos)
CREATE TABLE IF NOT EXISTS public.wishlist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_name text NOT NULL,
  artist text,
  max_price decimal(10, 2),
  category text,
  description text,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 2. Criar tabela de notificações
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('wishlist_match', 'transaction', 'review', 'message', 'system')),
  title text NOT NULL,
  message text NOT NULL,
  item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  related_id uuid, -- ID relacionado (transaction, review, etc)
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_wishlist_user ON public.wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_active ON public.wishlist(active);
CREATE INDEX IF NOT EXISTS idx_wishlist_item_name ON public.wishlist(LOWER(item_name));
CREATE INDEX IF NOT EXISTS idx_wishlist_category ON public.wishlist(LOWER(category));

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS para Wishlist

-- Usuários veem apenas seus próprios desejos
CREATE POLICY "Usuários veem seus desejos"
  ON public.wishlist
  FOR SELECT
  USING (auth.uid() = user_id);

-- Usuários criam seus próprios desejos
CREATE POLICY "Usuários criam desejos"
  ON public.wishlist
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Usuários atualizam seus próprios desejos
CREATE POLICY "Usuários atualizam desejos"
  ON public.wishlist
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Usuários deletam seus próprios desejos
CREATE POLICY "Usuários deletam desejos"
  ON public.wishlist
  FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Políticas RLS para Notifications

-- Usuários veem apenas suas notificações
CREATE POLICY "Usuários veem suas notificações"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Sistema pode criar notificações para qualquer usuário
CREATE POLICY "Sistema cria notificações"
  ON public.notifications
  FOR INSERT
  WITH CHECK (true);

-- Usuários podem atualizar suas notificações (marcar como lida)
CREATE POLICY "Usuários atualizam notificações"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Usuários podem deletar suas notificações
CREATE POLICY "Usuários deletam notificações"
  ON public.notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- 7. Função de Match Inteligente (verifica similaridade)
CREATE OR REPLACE FUNCTION check_wishlist_match(
  new_item_title text,
  new_item_artist text,
  new_item_category text,
  new_item_price decimal,
  new_item_id uuid
)
RETURNS void AS $$
DECLARE
  wish_record RECORD;
  match_found boolean;
BEGIN
  -- Procurar por matches na wishlist ativa
  FOR wish_record IN 
    SELECT * FROM wishlist 
    WHERE active = true
  LOOP
    match_found := false;
    
    -- Match por nome do item (case insensitive, partial match)
    IF wish_record.item_name IS NOT NULL AND new_item_title IS NOT NULL THEN
      IF LOWER(new_item_title) LIKE '%' || LOWER(wish_record.item_name) || '%' 
         OR LOWER(wish_record.item_name) LIKE '%' || LOWER(new_item_title) || '%' THEN
        match_found := true;
      END IF;
    END IF;
    
    -- Match por artista (case insensitive)
    IF NOT match_found AND wish_record.artist IS NOT NULL AND new_item_artist IS NOT NULL THEN
      IF LOWER(new_item_artist) LIKE '%' || LOWER(wish_record.artist) || '%' 
         OR LOWER(wish_record.artist) LIKE '%' || LOWER(new_item_artist) || '%' THEN
        match_found := true;
      END IF;
    END IF;
    
    -- Match por categoria (case insensitive)
    IF NOT match_found AND wish_record.category IS NOT NULL AND new_item_category IS NOT NULL THEN
      IF LOWER(new_item_category) = LOWER(wish_record.category) THEN
        match_found := true;
      END IF;
    END IF;
    
    -- Se houve match, verificar preço máximo (se definido)
    IF match_found THEN
      IF wish_record.max_price IS NULL OR new_item_price <= wish_record.max_price THEN
        -- MATCH CONFIRMADO! Criar notificação
        INSERT INTO notifications (
          user_id,
          type,
          title,
          message,
          item_id
        ) VALUES (
          wish_record.user_id,
          'wishlist_match',
          '🔥 ITEM ENCONTRADO!',
          'O item "' || new_item_title || '" que você procurava acaba de entrar no acervo! Preço: R$ ' || new_item_price,
          new_item_id
        );
        
        -- Log do match
        RAISE NOTICE 'Match encontrado: Item % para usuário %', new_item_title, wish_record.user_id;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Trigger que dispara após inserção de item
CREATE OR REPLACE FUNCTION trigger_wishlist_match()
RETURNS TRIGGER AS $$
BEGIN
  -- Executar verificação de match
  PERFORM check_wishlist_match(
    NEW.title,
    NEW.artist,
    NEW.condition, -- usando condition como categoria por enquanto
    NEW.price,
    NEW.id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS items_wishlist_match ON public.items;
CREATE TRIGGER items_wishlist_match
  AFTER INSERT ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_wishlist_match();

-- 9. Função para contar notificações não lidas
CREATE OR REPLACE FUNCTION get_unread_notifications_count(user_uuid uuid)
RETURNS bigint AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM notifications
    WHERE user_id = user_uuid
    AND is_read = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Função para marcar todas como lidas
CREATE OR REPLACE FUNCTION mark_all_notifications_read(user_uuid uuid)
RETURNS void AS $$
BEGIN
  UPDATE notifications
  SET is_read = true
  WHERE user_id = user_uuid
  AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Função para limpar notificações antigas (opcional)
CREATE OR REPLACE FUNCTION cleanup_old_notifications(days_old integer DEFAULT 30)
RETURNS void AS $$
BEGIN
  DELETE FROM notifications
  WHERE created_at < NOW() - (days_old || ' days')::interval
  AND is_read = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Trigger para atualizar updated_at na wishlist
CREATE OR REPLACE FUNCTION update_wishlist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wishlist_updated_at ON public.wishlist;
CREATE TRIGGER wishlist_updated_at
  BEFORE UPDATE ON public.wishlist
  FOR EACH ROW
  EXECUTE FUNCTION update_wishlist_updated_at();

-- 13. Comentários de documentação
COMMENT ON TABLE public.wishlist IS 'Lista de desejos dos usuários com match automático';
COMMENT ON TABLE public.notifications IS 'Notificações do sistema (wishlist, transações, reviews, etc)';
COMMENT ON COLUMN public.wishlist.item_name IS 'Nome do item desejado (partial match)';
COMMENT ON COLUMN public.wishlist.max_price IS 'Preço máximo que o usuário deseja pagar';
COMMENT ON COLUMN public.wishlist.active IS 'Se false, não faz match';
COMMENT ON COLUMN public.notifications.type IS 'wishlist_match | transaction | review | message | system';
COMMENT ON FUNCTION check_wishlist_match IS 'Verifica se novo item faz match com desejos ativos';
COMMENT ON FUNCTION get_unread_notifications_count IS 'Retorna total de notificações não lidas';

-- 14. Verificação final
SELECT 
  '✅ Tabela wishlist criada: ' || 
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'wishlist')
    THEN 'SIM'
    ELSE 'NÃO'
  END as tabela_wishlist;

SELECT 
  '✅ Tabela notifications criada: ' ||
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications')
    THEN 'SIM'
    ELSE 'NÃO'
  END as tabela_notifications;

SELECT 
  '✅ Trigger items_wishlist_match criado: ' ||
  CASE 
    WHEN EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'items_wishlist_match')
    THEN 'SIM'
    ELSE 'NÃO'
  END as trigger_match;

SELECT 
  '✅ Total de políticas RLS wishlist: ' || COUNT(*)::text
FROM pg_policies
WHERE tablename = 'wishlist';

SELECT 
  '✅ Total de políticas RLS notifications: ' || COUNT(*)::text
FROM pg_policies
WHERE tablename = 'notifications';

-- 15. Criar notificação de boas-vindas para teste
-- (Descomente para testar)
-- INSERT INTO notifications (user_id, type, title, message)
-- SELECT id, 'system', '🎉 Bem-vindo ao RareGroove!', 'Sistema de desejos ativado. Adicione itens à sua wishlist!'
-- FROM auth.users
-- LIMIT 1;

-- ========================================
-- 🎉 SISTEMA DE WISHLIST E NOTIFICAÇÕES PRONTO!
-- ========================================
-- Próximos passos:
-- 1. Criar interface WishlistModal no frontend
-- 2. Integrar aba "Meus Desejos" no Profile
-- 3. Adicionar botão no Catálogo quando não há resultados
-- 4. Criar componente de NotificationCenter
-- 5. Exibir badge de notificações não lidas

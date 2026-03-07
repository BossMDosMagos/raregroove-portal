-- ========================================
-- SISTEMA DE AVALIAÇÕES (REVIEWS) - RAREGROOVE
-- ========================================
-- Sistema completo de ratings e reviews para construir
-- reputação e autoridade entre os colecionadores

-- 1. Criar tabela de avaliações
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reviewed_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone DEFAULT now(),
  
  -- Garantir que cada usuário avalie apenas uma vez por transação
  UNIQUE(transaction_id, reviewer_id)
);

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_reviews_transaction ON public.reviews(transaction_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON public.reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewed ON public.reviews(reviewed_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON public.reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON public.reviews(created_at DESC);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Segurança

-- Todos podem VER avaliações (para mostrar reputação pública)
CREATE POLICY "Avaliações são públicas"
  ON public.reviews
  FOR SELECT
  USING (true);

-- Apenas participantes de transação CONCLUÍDA podem CRIAR avaliação
CREATE POLICY "Avaliar apenas transações concluídas"
  ON public.reviews
  FOR INSERT
  WITH CHECK (
    -- Verificar se é participante da transação
    auth.uid() IN (
      SELECT buyer_id FROM transactions WHERE id = transaction_id
      UNION
      SELECT seller_id FROM transactions WHERE id = transaction_id
    )
    -- Verificar se transação está concluída
    AND EXISTS (
      SELECT 1 FROM transactions 
      WHERE id = transaction_id 
      AND status = 'concluido'
    )
    -- Verificar se está avaliando a outra parte (não a si mesmo)
    AND auth.uid() = reviewer_id
    AND auth.uid() != reviewed_id
  );

-- Apenas o autor pode DELETAR sua própria avaliação
CREATE POLICY "Deletar próprias avaliações"
  ON public.reviews
  FOR DELETE
  USING (auth.uid() = reviewer_id);

-- Apenas o autor pode ATUALIZAR sua própria avaliação
CREATE POLICY "Atualizar próprias avaliações"
  ON public.reviews
  FOR UPDATE
  USING (auth.uid() = reviewer_id);

-- 5. Função para calcular rating médio de um usuário
CREATE OR REPLACE FUNCTION get_user_rating(user_uuid uuid)
RETURNS TABLE(
  avg_rating numeric,
  total_reviews bigint,
  rating_5_count bigint,
  rating_4_count bigint,
  rating_3_count bigint,
  rating_2_count bigint,
  rating_1_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROUND(AVG(rating)::numeric, 2) as avg_rating,
    COUNT(*) as total_reviews,
    COUNT(*) FILTER (WHERE rating = 5) as rating_5_count,
    COUNT(*) FILTER (WHERE rating = 4) as rating_4_count,
    COUNT(*) FILTER (WHERE rating = 3) as rating_3_count,
    COUNT(*) FILTER (WHERE rating = 2) as rating_2_count,
    COUNT(*) FILTER (WHERE rating = 1) as rating_1_count
  FROM reviews
  WHERE reviewed_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Função para verificar elegibilidade para badge Elite
CREATE OR REPLACE FUNCTION is_elite_seller(user_uuid uuid)
RETURNS TABLE(
  is_elite boolean,
  avg_rating numeric,
  completed_sales bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH seller_stats AS (
    SELECT 
      COUNT(*) as sales_count,
      AVG(r.rating) as avg_rating
    FROM transactions t
    LEFT JOIN reviews r ON r.transaction_id = t.id AND r.reviewed_id = user_uuid
    WHERE t.seller_id = user_uuid
    AND t.status = 'concluido'
  )
  SELECT 
    (sales_count >= 10 AND avg_rating >= 4.8) as is_elite,
    ROUND(avg_rating::numeric, 2) as avg_rating,
    sales_count as completed_sales
  FROM seller_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. View materializada para estatísticas de usuários (performance)
CREATE MATERIALIZED VIEW IF NOT EXISTS user_ratings_stats AS
SELECT 
  p.id as user_id,
  p.full_name,
  p.avatar_url,
  COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0) as avg_rating,
  COUNT(r.id) as total_reviews,
  COUNT(t.id) FILTER (WHERE t.status = 'concluido' AND t.seller_id = p.id) as completed_sales,
  COUNT(t.id) FILTER (WHERE t.status = 'concluido' AND t.buyer_id = p.id) as completed_purchases,
  COUNT(r.id) FILTER (WHERE r.rating = 5) as five_star_count,
  COUNT(r.id) FILTER (WHERE r.rating >= 4) as four_plus_star_count,
  -- Badge Elite: 10+ vendas com média >= 4.8
  (COUNT(t.id) FILTER (WHERE t.status = 'concluido' AND t.seller_id = p.id) >= 10 
   AND AVG(r.rating) >= 4.8) as is_elite
FROM profiles p
LEFT JOIN reviews r ON r.reviewed_id = p.id
LEFT JOIN transactions t ON (t.seller_id = p.id OR t.buyer_id = p.id)
GROUP BY p.id, p.full_name, p.avatar_url;

-- Criar índice único na view
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_ratings_stats_user_id 
  ON user_ratings_stats(user_id);

-- 8. Função para atualizar a view materializada
CREATE OR REPLACE FUNCTION refresh_user_ratings_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_ratings_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Trigger para atualizar stats quando review for inserida/atualizada/deletada
CREATE OR REPLACE FUNCTION trigger_refresh_ratings_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar de forma assíncrona (não bloquear a operação)
  PERFORM pg_notify('refresh_ratings', '');
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reviews_changed ON public.reviews;
CREATE TRIGGER reviews_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_ratings_stats();

-- 10. Comentários de documentação
COMMENT ON TABLE public.reviews IS 'Avaliações de usuários em transações concluídas';
COMMENT ON COLUMN public.reviews.rating IS 'Nota de 1 a 5 estrelas';
COMMENT ON COLUMN public.reviews.comment IS 'Comentário opcional do avaliador';
COMMENT ON FUNCTION get_user_rating IS 'Retorna estatísticas de rating de um usuário';
COMMENT ON FUNCTION is_elite_seller IS 'Verifica se usuário qualifica para badge Elite (10+ vendas, 4.8+ rating)';

-- 11. Verificação final
SELECT 
  '✅ Tabela reviews criada: ' || 
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'reviews')
    THEN 'SIM'
    ELSE 'NÃO'
  END as tabela_reviews;

SELECT 
  '✅ View user_ratings_stats criada: ' ||
  CASE 
    WHEN EXISTS(SELECT 1 FROM pg_matviews WHERE matviewname = 'user_ratings_stats')
    THEN 'SIM'
    ELSE 'NÃO'
  END as view_stats;

SELECT 
  '✅ Total de políticas RLS: ' || COUNT(*)::text
FROM pg_policies
WHERE tablename = 'reviews';

SELECT 
  '✅ Total de índices: ' || COUNT(*)::text
FROM pg_indexes
WHERE tablename = 'reviews';

-- 12. Popular view pela primeira vez
SELECT refresh_user_ratings_stats();

-- ========================================
-- 🎉 SISTEMA DE AVALIAÇÕES PRONTO!
-- ========================================
-- Próximos passos:
-- 1. Criar interface de ReviewModal no frontend
-- 2. Integrar display de ratings no Profile
-- 3. Exibir badges Elite nos avatares
-- 4. Mostrar ratings nos cards de itens

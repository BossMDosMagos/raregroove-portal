-- Função para verificar elegibilidade para badge Elite
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
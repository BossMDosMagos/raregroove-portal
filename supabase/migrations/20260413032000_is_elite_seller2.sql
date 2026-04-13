-- Função is_elite_seller
CREATE OR REPLACE FUNCTION is_elite_seller(user_uuid uuid)
RETURNS TABLE(is_elite boolean, avg_rating numeric, completed_sales bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT COUNT(*)::bigint as cnt, AVG(r.rating)::numeric as avg
    FROM transactions t
    LEFT JOIN reviews r ON r.transaction_id = t.id AND r.reviewed_id = user_uuid
    WHERE t.seller_id = user_uuid AND t.status = 'vendido'
  )
  SELECT (cnt >= 10 AND avg >= 4.8)::boolean, round(avg,2), cnt FROM stats;
END;
$$;
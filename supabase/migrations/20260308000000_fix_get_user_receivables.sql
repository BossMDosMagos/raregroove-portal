-- Atualizar função get_user_receivables para retornar valores líquidos e taxas
-- Isso permite exibir ao vendedor quanto ele realmente vai receber
CREATE OR REPLACE FUNCTION get_user_receivables(user_uuid uuid, limit_rows integer DEFAULT 10)
RETURNS TABLE(
  transaction_id uuid,
  item_id uuid,
  item_title text,
  item_image_url text,
  buyer_id uuid,
  buyer_name text,
  buyer_avatar text,
  price decimal,
  net_amount decimal, -- NOVO CAMPO
  platform_fee decimal, -- NOVO CAMPO
  gateway_fee decimal, -- NOVO CAMPO
  status text,
  shipping_id uuid,
  tracking_code text,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as transaction_id,
    t.item_id,
    i.title as item_title,
    i.image_url as item_image_url,
    t.buyer_id,
    p.full_name as buyer_name,
    p.avatar_url as buyer_avatar,
    t.price,
    t.net_amount, -- Retorna o valor líquido salvo na transação
    t.platform_fee,
    t.gateway_fee,
    t.status,
    t.shipping_id,
    s.tracking_code,
    t.created_at,
    t.updated_at
  FROM transactions t
  JOIN items i ON i.id = t.item_id
  JOIN profiles p ON p.id = t.buyer_id
  LEFT JOIN shipping s ON s.shipping_id = t.shipping_id
  WHERE t.seller_id = user_uuid
  ORDER BY t.created_at DESC
  LIMIT limit_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar funções financeiras para incluir shipping_id

-- 1. Dropar e recriar get_user_receivables para incluir shipping_id
DROP FUNCTION IF EXISTS get_user_receivables(uuid, integer);

CREATE FUNCTION get_user_receivables(user_uuid uuid, limit_rows integer DEFAULT 10)
RETURNS TABLE(
  transaction_id uuid,
  item_id uuid,
  item_title text,
  item_image_url text,
  buyer_id uuid,
  buyer_name text,
  buyer_avatar text,
  price decimal,
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

-- 2. Dropar e recriar get_user_purchases para incluir shipping_id
DROP FUNCTION IF EXISTS get_user_purchases(uuid, integer);

CREATE FUNCTION get_user_purchases(user_uuid uuid, limit_rows integer DEFAULT 10)
RETURNS TABLE(
  transaction_id uuid,
  item_id uuid,
  item_title text,
  item_image_url text,
  seller_id uuid,
  seller_name text,
  seller_avatar text,
  price decimal,
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
    t.seller_id,
    p.full_name as seller_name,
    p.avatar_url as seller_avatar,
    t.price,
    t.status,
    t.shipping_id,
    s.tracking_code,
    t.created_at,
    t.updated_at
  FROM transactions t
  JOIN items i ON i.id = t.item_id
  JOIN profiles p ON p.id = t.seller_id
  LEFT JOIN shipping s ON s.shipping_id = t.shipping_id
  WHERE t.buyer_id = user_uuid
  ORDER BY t.created_at DESC
  LIMIT limit_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

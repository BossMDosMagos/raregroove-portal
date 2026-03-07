-- =====================================================================
-- DIAGNÓSTICO: Verificar status do item TESTE2
-- =====================================================================

-- 1. Encontrar o item TESTE2
SELECT 
  id,
  title,
  is_sold,
  status,
  sold_to_id,
  sold_date,
  created_at,
  seller_id
FROM items
WHERE title ILIKE '%TESTE2%'
ORDER BY created_at DESC
LIMIT 5;

-- 2. Se encontrou, verificar vendedor
-- (Verificar se seller_id pertence a Cátia Regina Alves Hortega)

-- 3. Verificar transações deste item
SELECT 
  t.id,
  t.item_id,
  t.buyer_id,
  t.seller_id,
  t.price,
  t.total_amount,
  t.status as transaction_status,
  t.transaction_type,
  t.created_at
FROM transactions t
WHERE t.item_id IN (
  SELECT id FROM items WHERE title ILIKE '%TESTE2%'
)
ORDER BY t.created_at DESC
LIMIT 5;

-- =====================================================================
-- SE O ITEM AINDA NÃO ESTÁ MARCADO COMO VENDIDO:
-- =====================================================================

-- Execute isto para corrigir:
UPDATE items
SET 
  is_sold = true,
  status = 'vendido'
WHERE title ILIKE '%TESTE2%' AND is_sold = false;

-- Depois verificar novamente:
SELECT id, title, is_sold, status FROM items WHERE title ILIKE '%TESTE2%' LIMIT 1;

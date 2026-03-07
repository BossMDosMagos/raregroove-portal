-- =====================================================================
-- MANUTENÇÃO: Corrigir status de todos os itens vendidos
-- =====================================================================
-- Problema: Alguns itens têm is_sold=true mas status='disponivel'
-- Solução: Sincronizar ambos os campos

-- 1. Ver quantos itens estão inconsistentes
SELECT 
  COUNT(*) as itens_inconsistentes,
  'Itens com is_sold=true mas status!=vendido' as descricao
FROM items
WHERE is_sold = true AND status != 'vendido';

-- 2. Ver os itens inconsistentes (detalhes)
SELECT 
  id,
  title,
  is_sold,
  status,
  seller_id,
  created_at
FROM items
WHERE is_sold = true AND status != 'vendido'
ORDER BY created_at DESC;

-- 3. CORRIGIR todos os itens inconsistentes
UPDATE items
SET status = 'vendido'
WHERE is_sold = true AND status != 'vendido';

-- 4. Verificar resultado da correção
SELECT 
  COUNT(*) as itens_vendidos_corretos,
  'Itens com is_sold=true E status=vendido' as descricao
FROM items
WHERE is_sold = true AND status = 'vendido';

-- 5. Verificar se ainda existe algum inconsistente
SELECT 
  COUNT(*) as ainda_inconsistentes,
  'Deve ser ZERO!' as descricao
FROM items
WHERE is_sold = true AND status != 'vendido';

SELECT '✅ CORREÇÃO CONCLUÍDA! Todos os itens vendidos agora têm status correto.' AS resultado;

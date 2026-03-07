-- ========================================
-- CONSULTAS ÚTEIS - DASHBOARD FINANCEIRO
-- ========================================

-- 1. Dados financeiros de um usuário específico
SELECT * FROM get_user_financials('USER_UUID_AQUI');

-- 2. Top 10 vendedores por receita
SELECT * FROM seller_rankings
ORDER BY receita_total DESC
LIMIT 10;

-- 3. Recebíveis (vendas) de um usuário
SELECT * FROM get_user_receivables('USER_UUID_AQUI', 10);

-- 4. Compras de um usuário
SELECT * FROM get_user_purchases('USER_UUID_AQUI', 10);

-- 5. Todas as solicitações de saque pendentes
SELECT 
  w.id,
  w.amount,
  w.pix_key,
  w.requested_at,
  p.full_name as vendedor,
  p.email
FROM withdrawals w
JOIN profiles p ON p.id = w.user_id
WHERE w.status = 'pendente'
ORDER BY w.requested_at ASC;

-- 6. Dashboard geral da plataforma
SELECT 
  COUNT(DISTINCT seller_id) as total_vendedores,
  COUNT(*) as total_transacoes,
  SUM(price) FILTER (WHERE status = 'concluido') as gmv_total,
  SUM(price * 0.05) FILTER (WHERE status = 'concluido') as comissao_total,
  AVG(price) FILTER (WHERE status = 'concluido') as ticket_medio_plataforma,
  COUNT(*) FILTER (WHERE status = 'concluido') as vendas_concluidas,
  COUNT(*) FILTER (WHERE status = 'cancelado') as vendas_canceladas,
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'cancelado')::numeric / NULLIF(COUNT(*), 0)) * 100,
    2
  ) as taxa_cancelamento_pct
FROM transactions;

-- 7. Evolução de vendas por mês
SELECT 
  DATE_TRUNC('month', created_at) as mes,
  COUNT(*) as total_vendas,
  SUM(price) as receita,
  AVG(price) as ticket_medio,
  COUNT(*) FILTER (WHERE status = 'concluido') as concluidas,
  COUNT(*) FILTER (WHERE status = 'cancelado') as canceladas
FROM transactions
WHERE created_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY mes DESC;

-- 8. Vendedores com maior ticket médio (min 5 vendas)
SELECT 
  p.full_name,
  COUNT(t.id) as total_vendas,
  ROUND(AVG(t.price)::numeric, 2) as ticket_medio,
  SUM(t.price) as receita_total
FROM transactions t
JOIN profiles p ON p.id = t.seller_id
WHERE t.status = 'concluido'
GROUP BY p.id, p.full_name
HAVING COUNT(t.id) >= 5
ORDER BY AVG(t.price) DESC
LIMIT 10;

-- 9. Tempo médio para conclusão de vendas
SELECT 
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400) as dias_medio_conclusao
FROM transactions
WHERE status = 'concluido';

-- 10. Vendedores com vendas pendentes há mais de 7 dias
SELECT 
  p.full_name,
  COUNT(t.id) as vendas_travadas,
  SUM(t.price) as valor_travado,
  MIN(t.created_at) as venda_mais_antiga
FROM transactions t
JOIN profiles p ON p.id = t.seller_id
WHERE t.status IN ('pendente', 'pago')
AND t.created_at < NOW() - INTERVAL '7 days'
GROUP BY p.id, p.full_name
ORDER BY COUNT(t.id) DESC;

-- 11. Análise de performance por categoria/condição
SELECT 
  i.condition as categoria,
  COUNT(t.id) as total_vendas,
  SUM(t.price) as receita,
  AVG(t.price) as ticket_medio,
  COUNT(*) FILTER (WHERE t.status = 'concluido') as concluidas,
  ROUND(
    (COUNT(*) FILTER (WHERE t.status = 'concluido')::numeric / NULLIF(COUNT(*), 0)) * 100,
    2
  ) as taxa_conclusao_pct
FROM transactions t
JOIN items i ON i.id = t.item_id
WHERE t.created_at >= NOW() - INTERVAL '30 days'
GROUP BY i.condition
ORDER BY receita DESC;

-- 12. Saques processados vs pendentes
SELECT 
  status,
  COUNT(*) as quantidade,
  SUM(amount) as valor_total,
  AVG(amount) as valor_medio
FROM withdrawals
GROUP BY status
ORDER BY 
  CASE status
    WHEN 'pendente' THEN 1
    WHEN 'processando' THEN 2
    WHEN 'concluido' THEN 3
    WHEN 'cancelado' THEN 4
  END;

-- 13. Histórico financeiro completo de um usuário
SELECT 
  t.id,
  t.created_at,
  i.title as item,
  t.price,
  t.status,
  CASE 
    WHEN t.seller_id = 'USER_UUID_AQUI' THEN 'VENDA'
    ELSE 'COMPRA'
  END as tipo,
  CASE 
    WHEN t.seller_id = 'USER_UUID_AQUI' THEN pb.full_name
    ELSE ps.full_name
  END as outro_usuario
FROM transactions t
JOIN items i ON i.id = t.item_id
LEFT JOIN profiles ps ON ps.id = t.seller_id
LEFT JOIN profiles pb ON pb.id = t.buyer_id
WHERE t.seller_id = 'USER_UUID_AQUI' OR t.buyer_id = 'USER_UUID_AQUI'
ORDER BY t.created_at DESC;

-- 14. Vendedores elegíveis para saque (saldo > R$ 10)
SELECT 
  p.full_name,
  p.email,
  p.pix_key,
  f.saldo_disponivel,
  f.vendas_concluidas,
  f.ticket_medio
FROM profiles p
CROSS JOIN LATERAL get_user_financials(p.id) f
WHERE f.saldo_disponivel >= 10.00
AND p.pix_key IS NOT NULL
ORDER BY f.saldo_disponivel DESC;

-- 15. Comparativo vendedor vs comprador
SELECT 
  p.full_name,
  COUNT(DISTINCT ts.id) as vendas,
  SUM(ts.price) as receita_vendas,
  COUNT(DISTINCT tb.id) as compras,
  SUM(tb.price) as total_compras,
  (SUM(ts.price) - SUM(tb.price)) as balanco
FROM profiles p
LEFT JOIN transactions ts ON ts.seller_id = p.id AND ts.status = 'concluido'
LEFT JOIN transactions tb ON tb.buyer_id = p.id AND tb.status = 'concluido'
GROUP BY p.id, p.full_name
HAVING COUNT(DISTINCT ts.id) > 0 OR COUNT(DISTINCT tb.id) > 0
ORDER BY balanco DESC;

-- 16. Taxa de conversão por vendedor
SELECT 
  p.full_name,
  COUNT(*) as vendas_iniciadas,
  COUNT(*) FILTER (WHERE t.status = 'concluido') as vendas_concluidas,
  ROUND(
    (COUNT(*) FILTER (WHERE t.status = 'concluido')::numeric / NULLIF(COUNT(*), 0)) * 100,
    2
  ) as taxa_conversao_pct,
  SUM(t.price) FILTER (WHERE t.status = 'concluido') as receita
FROM transactions t
JOIN profiles p ON p.id = t.seller_id
GROUP BY p.id, p.full_name
HAVING COUNT(*) >= 3
ORDER BY taxa_conversao_pct DESC;

-- 17. Itens mais vendidos
SELECT 
  i.title,
  i.artist,
  COUNT(t.id) as vezes_vendido,
  AVG(t.price) as preco_medio,
  MAX(t.price) as preco_maximo,
  MIN(t.price) as preco_minimo
FROM transactions t
JOIN items i ON i.id = t.item_id
WHERE t.status = 'concluido'
GROUP BY i.title, i.artist
HAVING COUNT(t.id) > 1
ORDER BY COUNT(t.id) DESC
LIMIT 20;

-- 18. Análise de churn (vendedores inativos)
SELECT 
  p.full_name,
  COUNT(t.id) as total_vendas,
  MAX(t.created_at) as ultima_venda,
  AGE(NOW(), MAX(t.created_at)) as tempo_inativo
FROM profiles p
JOIN transactions t ON t.seller_id = p.id
GROUP BY p.id, p.full_name
HAVING MAX(t.created_at) < NOW() - INTERVAL '30 days'
ORDER BY MAX(t.created_at) ASC;

-- 19. Previsão de receita (vendas em andamento)
SELECT 
  COUNT(*) as vendas_em_andamento,
  SUM(price) as receita_potencial,
  COUNT(*) FILTER (WHERE status = 'pago') as ja_pagas,
  SUM(price) FILTER (WHERE status = 'pago') as valor_ja_pago
FROM transactions
WHERE status IN ('pendente', 'pago', 'enviado');

-- 20. Auditoria: Transações suspeitas (valores muito altos/baixos)
SELECT 
  t.id,
  t.created_at,
  i.title,
  t.price,
  ps.full_name as vendedor,
  pb.full_name as comprador,
  t.status
FROM transactions t
JOIN items i ON i.id = t.item_id
JOIN profiles ps ON ps.id = t.seller_id
JOIN profiles pb ON pb.id = t.buyer_id
WHERE t.price < 5.00 OR t.price > 1000.00
ORDER BY t.price DESC;

-- 21. Atualizar view de rankings (executar periodicamente)
SELECT refresh_seller_rankings();

-- 22. Processar um saque manualmente
UPDATE withdrawals
SET 
  status = 'concluido',
  processed_at = NOW(),
  notes = 'Processado manualmente via PIX'
WHERE id = 'WITHDRAWAL_UUID_AQUI';

-- 23. Cancelar um saque
UPDATE withdrawals
SET 
  status = 'cancelado',
  notes = 'Cancelado: [motivo aqui]'
WHERE id = 'WITHDRAWAL_UUID_AQUI';

-- 24. Simular cálculo de comissão
SELECT 
  DATE_TRUNC('month', created_at) as mes,
  SUM(price) as gmv,
  SUM(price * 0.05) as comissao_5pct,
  COUNT(*) as transacoes
FROM transactions
WHERE status = 'concluido'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY mes DESC;

-- 25. Usuários com chave PIX não cadastrada
SELECT 
  p.full_name,
  p.email,
  COUNT(t.id) as vendas_concluidas,
  SUM(t.price) as saldo_bloqueado
FROM profiles p
LEFT JOIN transactions t ON t.seller_id = p.id AND t.status = 'concluido'
WHERE p.pix_key IS NULL
GROUP BY p.id, p.full_name, p.email
HAVING COUNT(t.id) > 0
ORDER BY SUM(t.price) DESC;

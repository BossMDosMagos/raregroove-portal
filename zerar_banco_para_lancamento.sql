-- SCRIPT DE LIMPEZA TOTAL PARA LANÇAMENTO (RESET)
-- ATENÇÃO: ESTE SCRIPT APAGA TODOS OS DADOS DE TESTE DO SISTEMA!
-- RODE ISSO APENAS QUANDO O SITE ESTIVER PRONTO PARA IR AO AR OFICIALMENTE.

BEGIN;

-- 1. Limpar tabelas financeiras e de histórico (dependentes)
-- Remove todo o histórico de saldo, extrato e etiquetas de envio.
DELETE FROM public.financial_ledger;
DELETE FROM public.shipping_labels;
DELETE FROM public.shipping;
DELETE FROM public.notifications;

-- 2. Limpar transações (vendas e trocas)
-- Remove todos os registros de compras e trocas realizadas.
DELETE FROM public.transactions;

-- 3. Limpar itens (discos cadastrados)
-- Remove TODOS os itens do acervo (anúncios).
DELETE FROM public.items;

-- 4. Resetar saldos dos usuários para zero
-- Mantém as carteiras criadas, mas zera os valores.
UPDATE public.user_balances 
SET available_balance = 0, 
    pending_balance = 0, 
    held_balance = 0;

-- 5. Resetar Configurações do Sistema (Opcional)
-- Garante que o modo manutenção comece desativado
UPDATE public.system_settings
SET value = '{"enabled": false}'::jsonb
WHERE key = 'maintenance_mode';

COMMIT;

-- NOTAS IMPORTANTES:
-- 1. USUÁRIOS: Este script NÃO apaga os usuários. Para remover usuários de teste, vá no painel do Supabase > Authentication > Users.
-- 2. IMAGENS: Este script NÃO apaga as fotos dos discos no Storage. Para economizar espaço, vá no painel do Supabase > Storage > items-images e apague os arquivos manualmente.

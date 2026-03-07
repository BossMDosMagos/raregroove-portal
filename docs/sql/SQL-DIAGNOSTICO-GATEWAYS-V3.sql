-- ============================================================================
-- DIAGNÓSTICO DE GATEWAYS DE PAGAMENTO (VERSÃO FINAL 3.0)
-- ============================================================================

-- 1. Verificar configurações atuais de Gateway
SELECT 
    id, 
    gateway_provider, 
    gateway_mode, 
    updated_at 
FROM platform_settings;

-- 2. Limpar configurações conflitantes (Forçar Produção)
UPDATE platform_settings
SET 
    gateway_mode = 'production',
    gateway_provider = 'stripe', -- Default seguro
    updated_at = NOW()
WHERE id = 1;

-- 3. Inserir log de teste (Corrigido: provider deve ser um dos valores permitidos pela constraint)
-- Valores prováveis permitidos: 'stripe', 'mercado_pago', 'paypal'
INSERT INTO webhook_logs (provider, event_type, event_id, payload)
VALUES (
    'stripe', -- Usando 'stripe' que é garantido de existir na constraint
    'diagnostic_check', 
    'diag-' || extract(epoch from now())::text, 
    '{"status": "ok", "message": "Banco de dados acessível para logs"}'::jsonb
);

-- 4. Listar os últimos logs de webhook
SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT 5;

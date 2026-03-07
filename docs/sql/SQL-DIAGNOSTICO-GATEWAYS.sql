-- ============================================================================
-- DIAGNÓSTICO DE GATEWAYS DE PAGAMENTO
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

-- 3. Verificar se a tabela de logs de webhook existe (se não, criar para debug)
CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider TEXT NOT NULL,
    event_type TEXT,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Inserir log de teste para confirmar que o banco está acessível
INSERT INTO webhook_logs (provider, event_type, payload)
VALUES ('system', 'diagnostic_check', '{"status": "ok", "message": "Banco de dados acessível para logs"}'::jsonb);

-- 5. Listar os últimos logs de webhook (para ver se chegou algo do MP ou Stripe)
SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT 5;

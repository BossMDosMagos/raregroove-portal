-- ============================================================================
-- DIAGNÓSTICO DE GATEWAYS DE PAGAMENTO (CORRIGIDO)
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

-- 3. Verificar estrutura da tabela webhook_logs (caso já exista)
-- Se a tabela já existir com colunas obrigatórias, vamos respeitá-las.
-- O erro anterior indicou que 'event_id' é NOT NULL.

DO $$
BEGIN
    -- Se a tabela não existir, cria com estrutura flexível
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'webhook_logs') THEN
        CREATE TABLE webhook_logs (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            provider TEXT NOT NULL,
            event_type TEXT,
            event_id TEXT, -- Adicionado para compatibilidade
            payload JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END $$;

-- 4. Inserir log de teste (Corrigido para incluir event_id)
INSERT INTO webhook_logs (provider, event_type, event_id, payload)
VALUES (
    'system', 
    'diagnostic_check', 
    'diag-' || extract(epoch from now())::text, -- ID único fictício
    '{"status": "ok", "message": "Banco de dados acessível para logs"}'::jsonb
);

-- 5. Listar os últimos logs de webhook
SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT 5;

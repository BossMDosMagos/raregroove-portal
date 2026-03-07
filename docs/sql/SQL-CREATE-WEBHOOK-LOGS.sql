-- =============================================================================
-- CRIAR TABELA DE LOGS DE WEBHOOKS
-- =============================================================================
-- Registra todos os webhooks recebidos para auditoria e debugging
-- Útil para rastrear pagamentos e identificar tentativas de fraude

-- 1. Criar tabela
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text NOT NULL CHECK (provider IN ('stripe', 'mercadopago', 'paypal')),
  event_type text NOT NULL,
  event_id text UNIQUE NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Comentários
COMMENT ON TABLE public.webhook_logs IS 'Log de webhooks recebidos dos gateways de pagamento';
COMMENT ON COLUMN public.webhook_logs.provider IS 'Gateway que enviou o webhook: stripe, mercadopago, paypal';
COMMENT ON COLUMN public.webhook_logs.event_type IS 'Tipo do evento recebido (ex: payment_intent.succeeded)';
COMMENT ON COLUMN public.webhook_logs.event_id IS 'ID único do evento no gateway';
COMMENT ON COLUMN public.webhook_logs.payload IS 'Payload completo do webhook em JSON';
COMMENT ON COLUMN public.webhook_logs.processed_at IS 'Timestamp de quando o webhook foi processado';

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_webhook_logs_provider ON public.webhook_logs(provider);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type ON public.webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_id ON public.webhook_logs(event_id);

-- 4. RLS (Row Level Security)
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver logs de webhooks
DROP POLICY IF EXISTS "Admins podem ver logs" ON public.webhook_logs;
CREATE POLICY "Admins podem ver logs"
  ON public.webhook_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Edge Functions podem inserir logs (usando SERVICE_ROLE_KEY)
DROP POLICY IF EXISTS "Service role pode inserir logs" ON public.webhook_logs;
CREATE POLICY "Service role pode inserir logs"
  ON public.webhook_logs
  FOR INSERT
  WITH CHECK (true); -- Service role bypassa RLS de qualquer forma

-- 5. Função para limpar logs antigos (>90 dias)
CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.webhook_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  RAISE NOTICE 'Logs antigos de webhooks foram removidos';
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_webhook_logs() 
IS 'Remove logs de webhooks com mais de 90 dias para economizar espaço';

-- 6. Agendar limpeza automática (opcional - requer pg_cron extension)
-- SELECT cron.schedule('cleanup-webhook-logs', '0 3 * * 0', 'SELECT public.cleanup_old_webhook_logs()');

-- 7. View para análise de webhooks por dia
CREATE OR REPLACE VIEW public.webhook_logs_daily AS
SELECT 
  provider,
  event_type,
  DATE(created_at) as date,
  COUNT(*) as total_events,
  COUNT(DISTINCT event_id) as unique_events
FROM public.webhook_logs
GROUP BY provider, event_type, DATE(created_at)
ORDER BY date DESC, provider, event_type;

COMMENT ON VIEW public.webhook_logs_daily 
IS 'Agregação diária de webhooks recebidos por provider e tipo';

-- 8. Verificação
SELECT 
  'Tabela webhook_logs criada: ' ||
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'webhook_logs')
    THEN '✅ SIM'
    ELSE '❌ NÃO'
  END as status;

SELECT 
  'Total de políticas RLS: ' || COUNT(*)::text
FROM pg_policies
WHERE tablename = 'webhook_logs';

-- 9. Consultas úteis para monitoramento

-- Ver últimos 10 webhooks recebidos
-- SELECT id, provider, event_type, created_at 
-- FROM webhook_logs 
-- ORDER BY created_at DESC 
-- LIMIT 10;

-- Ver webhooks por tipo nas últimas 24h
-- SELECT event_type, COUNT(*) as total
-- FROM webhook_logs
-- WHERE created_at > NOW() - INTERVAL '24 hours'
-- GROUP BY event_type
-- ORDER BY total DESC;

-- Buscar webhook específico por event_id
-- SELECT * FROM webhook_logs WHERE event_id = 'evt_xxxxxxxxxxxxx';

-- Ver taxa de webhooks por hora (últimas 24h)
-- SELECT 
--   DATE_TRUNC('hour', created_at) as hour,
--   provider,
--   COUNT(*) as total
-- FROM webhook_logs
-- WHERE created_at > NOW() - INTERVAL '24 hours'
-- GROUP BY hour, provider
-- ORDER BY hour DESC;

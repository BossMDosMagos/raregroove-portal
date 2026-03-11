CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'escrow_sla_15m') THEN
      PERFORM cron.schedule(
        'escrow_sla_15m',
        '*/15 * * * *',
        $job$select public.run_escrow_sla();$job$
      );
    END IF;
  END IF;
END $$;

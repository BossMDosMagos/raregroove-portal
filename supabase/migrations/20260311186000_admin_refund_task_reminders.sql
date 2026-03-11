CREATE OR REPLACE FUNCTION public.notify_admin_refund_tasks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending_count int := 0;
  v_dedupe text := 'admin:refund_tasks:' || to_char(now(), 'YYYY-MM-DD');
BEGIN
  IF to_regclass('public.notifications') IS NULL OR to_regclass('public.dispute_refund_tasks') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'missing tables');
  END IF;

  SELECT COUNT(*) INTO v_pending_count
  FROM public.dispute_refund_tasks
  WHERE status = 'pending_execution';

  IF v_pending_count = 0 THEN
    RETURN jsonb_build_object('success', true, 'pending', 0);
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, item_id, related_id, dedupe_key, is_read, created_at)
  SELECT
    p.id,
    'system',
    'REEMBOLSOS PENDENTES',
    'Há ' || v_pending_count::text || ' reembolso(s) aguardando execução. Acesse /admin/refunds.',
    NULL,
    NULL,
    v_dedupe || ':' || p.id::text,
    false,
    now()
  FROM public.profiles p
  WHERE p.is_admin = true
  ON CONFLICT (user_id, dedupe_key) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'pending', v_pending_count);
END;
$$;

REVOKE ALL ON FUNCTION public.notify_admin_refund_tasks() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refund_tasks_reminder_6h') THEN
      PERFORM cron.schedule(
        'refund_tasks_reminder_6h',
        '0 */6 * * *',
        $job$select public.notify_admin_refund_tasks();$job$
      );
    END IF;
  END IF;
END $$;


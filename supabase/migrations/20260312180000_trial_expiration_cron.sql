DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'profiles_subscription_status_check'
        AND conrelid = 'public.profiles'::regclass
    ) THEN
      ALTER TABLE public.profiles
      DROP CONSTRAINT profiles_subscription_status_check;
    END IF;

    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_subscription_status_check
    CHECK (subscription_status IN ('inactive', 'trialing', 'expired', 'active', 'past_due', 'canceled')) NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.expire_trials()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.profiles
  SET subscription_status = 'expired',
      subscription_plan = COALESCE(subscription_plan, 'trial'),
      user_level = 0
  WHERE subscription_status = 'trialing'
    AND subscription_trial_ends_at IS NOT NULL
    AND subscription_trial_ends_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire_trials_5m') THEN
      PERFORM cron.schedule(
        'expire_trials_5m',
        '*/5 * * * *',
        $job$select public.expire_trials();$job$
      );
    END IF;
  END IF;
END $$;


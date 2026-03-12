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
    CHECK (subscription_status IN ('inactive', 'trialing', 'active', 'past_due', 'canceled')) NOT VALID;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'subscription_trial_started_at'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN subscription_trial_started_at timestamptz;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'subscription_trial_ends_at'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN subscription_trial_ends_at timestamptz;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'subscription_data_used_gb'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN subscription_data_used_gb numeric NOT NULL DEFAULT 0;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'subscription_plans'
  ) THEN
    CREATE TABLE public.subscription_plans (
      plan_id text PRIMARY KEY,
      name text NOT NULL,
      description text NOT NULL DEFAULT '',
      price_brl numeric NOT NULL DEFAULT 0,
      price_usd numeric NOT NULL DEFAULT 0,
      user_level integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      updated_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.subscription_plans') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.subscription_plans (plan_id, name, description, price_brl, price_usd, user_level, is_active)
  VALUES
    ('digger', 'DIGGER', 'Entrada', 14.90, 2.99, 1, true),
    ('keeper', 'KEEPER', 'Custo-benefício', 34.90, 6.99, 2, true),
    ('high_guardian', 'HIGH GUARDIAN', 'Elite / Full Access', 69.90, 13.99, 3, true)
  ON CONFLICT (plan_id)
  DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_brl = EXCLUDED.price_brl,
    price_usd = EXCLUDED.price_usd,
    user_level = EXCLUDED.user_level,
    is_active = EXCLUDED.is_active,
    updated_at = now();
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'subscription_settings'
  ) THEN
    CREATE TABLE public.subscription_settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      trial_days integer NOT NULL DEFAULT 7,
      trial_data_limit_gb numeric NOT NULL DEFAULT 5,
      block_downloads_on_trial boolean NOT NULL DEFAULT true,
      limit_audio_quality_on_trial boolean NOT NULL DEFAULT true,
      max_trial_quality text NOT NULL DEFAULT 'preview',
      updated_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.subscription_settings') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.subscription_settings) THEN
    INSERT INTO public.subscription_settings (trial_days, trial_data_limit_gb, block_downloads_on_trial, limit_audio_quality_on_trial, max_trial_quality)
    VALUES (7, 5, true, true, 'preview');
  END IF;
END $$;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Subscription plans read" ON public.subscription_plans;
CREATE POLICY "Subscription plans read"
ON public.subscription_plans
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Subscription plans admin write" ON public.subscription_plans;
CREATE POLICY "Subscription plans admin write"
ON public.subscription_plans
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND COALESCE(p.is_admin, false) = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND COALESCE(p.is_admin, false) = true
  )
);

DROP POLICY IF EXISTS "Subscription settings read" ON public.subscription_settings;
CREATE POLICY "Subscription settings read"
ON public.subscription_settings
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Subscription settings admin write" ON public.subscription_settings;
CREATE POLICY "Subscription settings admin write"
ON public.subscription_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND COALESCE(p.is_admin, false) = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND COALESCE(p.is_admin, false) = true
  )
);

CREATE OR REPLACE FUNCTION public.start_subscription_trial()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_settings record;
  v_profile record;
  v_trial_ends timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_settings
  FROM public.subscription_settings
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_settings IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_settings');
  END IF;

  SELECT id, subscription_status, subscription_trial_started_at
  INTO v_profile
  FROM public.profiles
  WHERE id = v_user;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_profile');
  END IF;

  IF v_profile.subscription_status IN ('active', 'trialing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_has_access');
  END IF;

  IF v_profile.subscription_trial_started_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'trial_already_used');
  END IF;

  v_trial_ends := now() + make_interval(days => v_settings.trial_days);

  UPDATE public.profiles
  SET subscription_status = 'trialing',
      subscription_trial_started_at = now(),
      subscription_trial_ends_at = v_trial_ends,
      subscription_plan = 'trial',
      user_level = GREATEST(COALESCE(user_level, 0), 1),
      subscription_date = now()
  WHERE id = v_user;

  RETURN jsonb_build_object('ok', true, 'trial_days', v_settings.trial_days, 'trial_ends_at', v_trial_ends);
END;
$$;


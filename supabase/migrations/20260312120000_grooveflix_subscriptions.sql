DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_level'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN user_level integer NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'subscription_status'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN subscription_status text NOT NULL DEFAULT 'inactive';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'subscription_plan'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN subscription_plan text;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'subscription_date'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN subscription_date timestamptz;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_subscription_status_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_subscription_status_check
    CHECK (subscription_status IN ('inactive', 'active', 'past_due', 'canceled')) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
  ) THEN
    CREATE TABLE public.subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      plan_id text NOT NULL,
      user_level integer NOT NULL,
      status text NOT NULL DEFAULT 'active',
      provider text NOT NULL,
      payment_id text NOT NULL,
      external_reference text,
      amount numeric,
      currency text,
      subscribed_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_payment_unique
ON public.subscriptions(provider, payment_id);

CREATE INDEX IF NOT EXISTS subscriptions_user_created_idx
ON public.subscriptions(user_id, created_at DESC);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own subscriptions" ON public.subscriptions;
CREATE POLICY "Users see own subscriptions"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "No insert subscriptions" ON public.subscriptions;
CREATE POLICY "No insert subscriptions"
ON public.subscriptions
FOR INSERT
TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "No update subscriptions" ON public.subscriptions;
CREATE POLICY "No update subscriptions"
ON public.subscriptions
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "No delete subscriptions" ON public.subscriptions;
CREATE POLICY "No delete subscriptions"
ON public.subscriptions
FOR DELETE
TO authenticated
USING (false);


DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'subscription_provider'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN subscription_provider text;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'stripe_customer_id'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN stripe_customer_id text;
    END IF;
  END IF;
END $$;


DO $$
BEGIN
  IF to_regclass('public.items') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'items' AND column_name = 'metadata'
    ) THEN
      ALTER TABLE public.items
      ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
    END IF;
  END IF;
END $$;


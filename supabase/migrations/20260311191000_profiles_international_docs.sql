DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'country_code'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN country_code text NOT NULL DEFAULT 'BR';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'cpf_cnpj'
    ) THEN
      ALTER TABLE public.profiles ALTER COLUMN cpf_cnpj TYPE text;
      ALTER TABLE public.profiles ALTER COLUMN cpf_cnpj DROP NOT NULL;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'rg'
    ) THEN
      ALTER TABLE public.profiles ALTER COLUMN rg TYPE text;
      ALTER TABLE public.profiles ALTER COLUMN rg DROP NOT NULL;
    END IF;
  END IF;
END $$;

DO $$
DECLARE
  r record;
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RETURN;
  END IF;

  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.profiles'::regclass
      AND c.contype = 'u'
      AND EXISTS (
        SELECT 1
        FROM unnest(c.conkey) k
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
        WHERE a.attname = 'cpf_cnpj'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(c.conkey) k
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
        WHERE a.attname = 'country_code'
      )
  ) LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;

  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.profiles'::regclass
      AND c.contype = 'u'
      AND EXISTS (
        SELECT 1
        FROM unnest(c.conkey) k
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
        WHERE a.attname = 'rg'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(c.conkey) k
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
        WHERE a.attname = 'country_code'
      )
  ) LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;

  FOR r IN (
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND indexdef ILIKE '%unique%'
      AND indexdef ILIKE '%(cpf_cnpj%'
      AND indexdef NOT ILIKE '%country_code%'
  ) LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', r.indexname);
  END LOOP;

  FOR r IN (
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND indexdef ILIKE '%unique%'
      AND indexdef ILIKE '%(rg%'
      AND indexdef NOT ILIKE '%country_code%'
  ) LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', r.indexname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RETURN;
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS profiles_country_cpf_unique
  ON public.profiles (country_code, cpf_cnpj)
  WHERE cpf_cnpj IS NOT NULL AND cpf_cnpj <> '';

  CREATE UNIQUE INDEX IF NOT EXISTS profiles_country_rg_unique
  ON public.profiles (country_code, rg)
  WHERE rg IS NOT NULL AND rg <> '';
END $$;


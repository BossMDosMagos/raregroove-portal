CREATE TABLE IF NOT EXISTS public.site_stats (
  id integer PRIMARY KEY,
  total_visits bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_stats REPLICA IDENTITY FULL;

INSERT INTO public.site_stats (id, total_visits)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.increment_total_visits()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
BEGIN
  UPDATE public.site_stats
  SET total_visits = total_visits + 1,
      updated_at = now()
  WHERE id = 1
  RETURNING total_visits INTO v_total;

  IF v_total IS NULL THEN
    INSERT INTO public.site_stats (id, total_visits, updated_at)
    VALUES (1, 1, now())
    ON CONFLICT (id) DO UPDATE
      SET total_visits = public.site_stats.total_visits + 1,
          updated_at = now()
    RETURNING total_visits INTO v_total;
  END IF;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_total_visits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_total_visits() TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'site_stats'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.site_stats';
    END IF;
  END IF;
END $$;


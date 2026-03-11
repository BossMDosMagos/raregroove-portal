GRANT SELECT ON TABLE public.site_stats TO anon, authenticated;

ALTER TABLE public.site_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_site_stats" ON public.site_stats;
CREATE POLICY "read_site_stats"
ON public.site_stats
FOR SELECT
TO anon, authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.get_total_visits()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT total_visits FROM public.site_stats WHERE id = 1;
$$;

REVOKE ALL ON FUNCTION public.get_total_visits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_total_visits() TO anon, authenticated;


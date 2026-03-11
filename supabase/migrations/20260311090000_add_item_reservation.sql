ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS reserved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS reserved_until timestamptz;

CREATE OR REPLACE FUNCTION public.reserve_item(item_uuid uuid, duration_minutes integer DEFAULT 15)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_until timestamptz := now() + make_interval(mins => duration_minutes);
  v_updated integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.items
  SET status = 'reservado',
      reserved_by = v_user,
      reserved_until = v_until
  WHERE id = item_uuid
    AND is_sold = false
    AND (
      (status IS NULL OR status = 'disponivel')
      OR (status = 'reservado' AND reserved_by = v_user)
    )
    AND (
      reserved_until IS NULL
      OR reserved_until < now()
      OR reserved_by = v_user
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'not_available';
  END IF;

  RETURN jsonb_build_object('reserved_until', v_until);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_item_reservation(item_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_updated integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.items
  SET status = 'disponivel',
      reserved_by = NULL,
      reserved_until = NULL
  WHERE id = item_uuid
    AND status = 'reservado'
    AND (
      reserved_by = v_user
      OR (reserved_until IS NOT NULL AND reserved_until < now())
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_item(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_item_reservation(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.reserve_item(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_item_reservation(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.admin_set_admin_manual_access_by_email(target_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_target uuid;
  v_sql_editor boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    IF current_user IN ('postgres', 'supabase_admin') THEN
      v_sql_editor := true;
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
    END IF;
  END IF;

  IF NOT v_sql_editor THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid AND COALESCE(p.is_admin, false) = true) THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_admin');
    END IF;
  END IF;

  IF target_email IS NULL OR length(trim(target_email)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_email');
  END IF;

  SELECT u.id
  INTO v_target
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(target_email))
  LIMIT 1;

  IF v_target IS NULL THEN
    SELECT p.id
    INTO v_target
    FROM public.profiles p
    WHERE lower(p.email) = lower(trim(target_email))
    LIMIT 1;
  END IF;

  IF v_target IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;

  UPDATE public.profiles
  SET subscription_status = 'active',
      user_level = GREATEST(COALESCE(user_level, 0), 3),
      subscription_provider = 'admin_manual',
      subscription_plan = COALESCE(subscription_plan, 'high_guardian'),
      subscription_date = now(),
      subscription_trial_started_at = null,
      subscription_trial_ends_at = null,
      subscription_data_used_gb = 0
  WHERE id = v_target;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  RETURN jsonb_build_object('success', true, 'user_id', v_target);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_admin_manual_access_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_admin_manual_access_by_email(text) TO authenticated;


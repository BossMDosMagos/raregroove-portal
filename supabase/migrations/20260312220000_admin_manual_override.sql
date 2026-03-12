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
    AND COALESCE(subscription_provider, '') <> 'admin_manual'
    AND subscription_trial_ends_at IS NOT NULL
    AND subscription_trial_ends_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_admin_manual_access(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid AND COALESCE(p.is_admin, false) = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_admin');
  END IF;

  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_target');
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
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_admin_manual_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_admin_manual_access(uuid) TO authenticated;


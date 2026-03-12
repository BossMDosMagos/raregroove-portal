CREATE OR REPLACE FUNCTION public.increment_trial_usage(delta_gb numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_settings record;
  v_profile record;
  v_new numeric;
  v_limit numeric;
  v_expired boolean := false;
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

  SELECT id, subscription_status, subscription_trial_ends_at, subscription_data_used_gb
  INTO v_profile
  FROM public.profiles
  WHERE id = v_user;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_profile');
  END IF;

  IF v_profile.subscription_status <> 'trialing' THEN
    RETURN jsonb_build_object('ok', true, 'status', v_profile.subscription_status, 'used_gb', v_profile.subscription_data_used_gb);
  END IF;

  IF v_profile.subscription_trial_ends_at IS NULL OR v_profile.subscription_trial_ends_at < now() THEN
    UPDATE public.profiles
    SET subscription_status = 'expired',
        user_level = 0
    WHERE id = v_user;

    RETURN jsonb_build_object('ok', true, 'status', 'expired', 'used_gb', v_profile.subscription_data_used_gb);
  END IF;

  v_new := COALESCE(v_profile.subscription_data_used_gb, 0) + GREATEST(COALESCE(delta_gb, 0), 0);
  v_limit := COALESCE(v_settings.trial_data_limit_gb, 0);

  IF v_limit > 0 AND v_new >= v_limit THEN
    v_expired := true;
  END IF;

  UPDATE public.profiles
  SET subscription_data_used_gb = v_new,
      subscription_status = CASE WHEN v_expired THEN 'expired' ELSE 'trialing' END,
      user_level = CASE WHEN v_expired THEN 0 ELSE user_level END
  WHERE id = v_user;

  RETURN jsonb_build_object(
    'ok', true,
    'status', CASE WHEN v_expired THEN 'expired' ELSE 'trialing' END,
    'used_gb', v_new,
    'limit_gb', v_limit
  );
END;
$$;


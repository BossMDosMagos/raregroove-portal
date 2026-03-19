-- Migration: Restaurar perfil do admin
-- RareGroove CDS e Swap - Administrador do Portal

BEGIN;

-- 1. Buscar UID pelo email no auth.users
DO $$
DECLARE
  v_user_id UUID;
  v_email TEXT := 'raregroovecdseswapsafe@gmail.com';
  v_exists INTEGER;
BEGIN
  -- Buscar ID do usuário
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Usuário não encontrado no auth.users com email: %', v_email;
    RETURN;
  END IF;
  
  RAISE NOTICE 'UID encontrado: %', v_user_id;
  
  -- Verificar se perfil existe
  SELECT COUNT(*) INTO v_exists
  FROM public.profiles
  WHERE id = v_user_id;
  
  IF v_exists = 0 THEN
    -- Criar perfil
    INSERT INTO public.profiles (
      id,
      email,
      full_name,
      is_admin,
      user_level,
      subscription_status,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      v_email,
      'Administrador',
      true,
      99,
      'active',
      now(),
      now()
    );
    RAISE NOTICE 'Perfil criado com sucesso!';
  ELSE
    -- Apenas atualizar
    UPDATE public.profiles SET
      is_admin = true,
      user_level = 99,
      subscription_status = 'active',
      updated_at = now()
    WHERE id = v_user_id;
    RAISE NOTICE 'Perfil atualizado!';
  END IF;
END $$;

COMMIT;

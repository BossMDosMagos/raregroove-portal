-- Migration: Set Admin for raregroovecdseswapsafe@gmail.com
-- Garantir que o administrador do portal tenha acesso total

BEGIN;

-- Atualizar profile para admin
UPDATE public.profiles 
SET 
  is_admin = true,
  user_level = 99,
  subscription_status = 'active'
WHERE email = 'raregroovecdseswapsafe@gmail.com';

-- Confirmar atualização
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.profiles 
  WHERE email = 'raregroovecdseswapsafe@gmail.com' AND is_admin = true;
  
  RAISE NOTICE 'Admin atualizado: % registros com is_admin=true', v_count;
END $$;

COMMIT;

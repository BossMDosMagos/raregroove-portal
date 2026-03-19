-- Verificar e atualizar admin
UPDATE public.profiles 
SET is_admin = true 
WHERE email = 'raregroovecdseswapsafe@gmail.com'
OR id IN (
  SELECT id FROM auth.users WHERE email = 'raregroovecdseswapsafe@gmail.com'
);

-- Confirmar resultado
SELECT id, email, full_name, is_admin, subscription_status, user_level 
FROM public.profiles 
WHERE email = 'raregroovecdseswapsafe@gmail.com'
OR id IN (
  SELECT id FROM auth.users WHERE email = 'raregroovecdseswapsafe@gmail.com'
);

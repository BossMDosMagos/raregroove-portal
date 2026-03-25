-- ========================================
-- CORREÇÃO: RECURSÃO INFINITA NA POLÍTICA ADMIN
-- ========================================
-- Execute isto IMEDIATAMENTE no Supabase SQL Editor
-- para corrigir o erro "infinite recursion detected"

-- 1) Remover política problemática
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- 2) Criar função auxiliar (sem recursão)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3) Criar política corrigida
CREATE POLICY "Admins can manage all profiles"
ON public.profiles
FOR ALL
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- 4) Garantir que seu email está marcado como admin
UPDATE public.profiles
SET is_admin = true
WHERE email = 'raregroovecdseswapsafe@gmail.com';

-- ========================================
-- TESTE DE FUNCIONAMENTO
-- ========================================
-- Após executar, faça logout e login novamente
-- Tente acessar /admin e editar seu perfil

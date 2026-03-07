-- ========================================
-- BLINDAGEM DE IDENTIDADE + ADMIN ROLE
-- ========================================
-- Garante unicidade de email, CPF/CNPJ e RG
-- e define coluna is_admin no perfil

-- 1) Colunas de documentos, status e admin
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT,
  ADD COLUMN IF NOT EXISTS rg TEXT,
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspension_end TIMESTAMP WITH TIME ZONE;

-- 2) Unicidade por indices (nao quebra se ja existir)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique
  ON public.profiles (email);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_cnpj_unique
  ON public.profiles (cpf_cnpj)
  WHERE cpf_cnpj IS NOT NULL AND cpf_cnpj <> '';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_rg_unique
  ON public.profiles (rg)
  WHERE rg IS NOT NULL AND rg <> '';

-- 3) Definir email admin (troque abaixo)
UPDATE public.profiles
SET is_admin = true
WHERE email = 'raregroovecdseswapsafe@gmail.com';

-- 4) Funcao auxiliar para verificar admin (sem recursao)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5) Politica de RLS: Admins podem ver e editar todos os perfis
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles"
ON public.profiles
FOR ALL
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- 6) Verificacao rapida
SELECT
  'email_unique' AS constraint,
  COUNT(*) AS duplicates
FROM public.profiles
GROUP BY email
HAVING COUNT(*) > 1;
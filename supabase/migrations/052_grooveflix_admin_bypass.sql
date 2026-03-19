-- Migration: Grooveflix Admin Bypass
-- Garantir que usuários com is_admin = true possam acessar Grooveflix sem assinatura

BEGIN;

-- ============================================
-- 1. ATUALIZAR RLS DA TABELA PROFILES
-- Permitir que admins vejam QUALQUER perfil
-- ============================================
DROP POLICY IF EXISTS "Admins podem ver todos os perfis" ON profiles;
CREATE POLICY "Admins podem ver todos os perfis"
ON profiles
FOR SELECT
USING (
  auth.uid() = id 
  OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true
  )
);

-- ============================================
-- 2. CRIAR FUNÇÃO PARA VERIFICAR ACESSO ADMIN
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  SELECT COALESCE(p.is_admin, FALSE) INTO v_is_admin
  FROM public.profiles p
  WHERE p.id = auth.uid();
  
  RETURN COALESCE(v_is_admin, FALSE);
END;
$$;

-- ============================================
-- 3. GARANTIR QUE ADMINISTRADORES TENHAM ACESSO TOTAL
-- Usar a função em todas as verificações de subscription
-- ============================================
DO $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Verificar se a função existe
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin_user') THEN
    RAISE NOTICE 'Função is_admin_user já existe, continuando...';
  ELSE
    RAISE NOTICE 'Função is_admin_user será criada...';
  END IF;
END $$;

-- ============================================
-- 4. POLÍTICAS RLS PARA SUBSCRIPTIONS COM BYPASS ADMIN
-- ============================================
DROP POLICY IF EXISTS "Admins veem todas assinaturas" ON subscriptions;
CREATE POLICY "Admins veem todas assinaturas"
ON subscriptions
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.is_admin_user() = true
);

-- ============================================
-- 5. ATUALIZAR GROOVEFLIX GATEKEEPER
-- A função JavaScript já verifica is_admin,
-- mas vamos garantir que a query funcione
-- ============================================

-- Criar função RPC para verificar acesso rápido
DROP FUNCTION IF EXISTS public.check_grooveflix_access();
CREATE OR REPLACE FUNCTION public.check_grooveflix_access()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_is_admin BOOLEAN;
  v_user_level INTEGER;
  v_subscription_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'not_authenticated'
    );
  END IF;
  
  SELECT 
    COALESCE(p.is_admin, FALSE),
    COALESCE(p.user_level, 0),
    COALESCE(p.subscription_status, 'inactive')
  INTO v_is_admin, v_user_level, v_subscription_status
  FROM public.profiles p
  WHERE p.id = auth.uid();
  
  -- ADMIN SEMPRE TEM ACESSO
  IF v_is_admin = TRUE THEN
    RETURN json_build_object(
      'allowed', true,
      'is_admin', true,
      'reason', 'admin_bypass'
    );
  END IF;
  
  -- Verifica nível e status
  IF v_user_level > 0 AND v_subscription_status = 'active' THEN
    RETURN json_build_object(
      'allowed', true,
      'is_admin', false,
      'reason', 'subscription_active'
    );
  END IF;
  
  RETURN json_build_object(
    'allowed', false,
    'is_admin', false,
    'user_level', v_user_level,
    'subscription_status', v_subscription_status,
    'reason', 'subscription_required'
  );
END;
$$;

-- ============================================
-- 6. GRANT PERMISSIONS
-- ============================================
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_grooveflix_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_grooveflix_access() TO anon;

COMMIT;

-- URGENTE: Corrigir Loop Infinito de RLS
-- Remove políticas recursivas e cria políticas limpas

BEGIN;

-- 1. DROPAR TODAS POLÍTICAS DA TABELA PROFILES
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Admins can do everything" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem ver todos os perfis" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem ver nomes de colecionadores" ON public.profiles;
DROP POLICY IF EXISTS "Users can view public profiles" ON public.profiles;

-- 2. CRIAR POLÍTICAS CORRETAS (sem recursão!)
-- Todos podem ver todos os perfis (necessário para o chat e lista de usuários)
CREATE POLICY "Profiles are viewable by everyone" 
ON public.profiles FOR SELECT USING (true);

-- 3. Usuários podem inserir seu próprio perfil
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 4. Usuários podem atualizar seu próprio perfil
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 5. ADMIN BYPASS via função RPC (não via RLS)
-- A função check_grooveflix_access já existe e funciona

-- 6. RESTAURAR PERFIL DO ADMIN
DO $$
DECLARE
  v_user_id UUID;
  v_email TEXT := 'raregroovecdseswapsafe@gmail.com';
  v_count INTEGER;
BEGIN
  -- Buscar ID do usuário no auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'ERRO: Usuário não encontrado no auth.users!';
    RETURN;
  END IF;
  
  RAISE NOTICE 'UID do admin: %', v_user_id;
  
  -- Verificar se perfil existe
  SELECT COUNT(*) INTO v_count
  FROM public.profiles
  WHERE id = v_user_id;
  
  IF v_count = 0 THEN
    -- Criar perfil do zero
    INSERT INTO public.profiles (id, email, full_name, is_admin, user_level, subscription_status, created_at, updated_at)
    VALUES (v_user_id, v_email, 'Administrador RareGroove', true, 99, 'active', now(), now());
    RAISE NOTICE 'PERFIL CRIADO com sucesso!';
  ELSE
    -- Apenas garantir que está correto
    UPDATE public.profiles SET
      is_admin = true,
      user_level = 99,
      subscription_status = 'active',
      updated_at = now()
    WHERE id = v_user_id;
    RAISE NOTICE 'PERFIL ATUALIZADO!';
  END IF;
END $$;

COMMIT;

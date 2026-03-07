-- ============================================================================
-- CORREÇÃO DO FLUXO DE SIGNUP - RLS E TRIGGER
-- ============================================================================
-- Data: 2026-03-01
-- Problema: "Não foi possível salvar seu perfil" durante cadastro
-- Causa: Política RLS INSERT bloqueando trigger e UPDATE durante signup
--
-- EXECUTE ESTE SCRIPT NO SUPABASE SQL EDITOR (1 comando de cada vez)
-- ============================================================================

-- ============================================================================
-- PARTE 1: REMOVER POLÍTICA INSERT BLOQUEADORA
-- ============================================================================
-- A política INSERT bloqueia porque auth.uid() é NULL durante signup
-- O trigger handle_new_user cuida da criação, não precisa de política INSERT

DROP POLICY IF EXISTS "Usuários podem criar seu próprio perfil" ON profiles;

-- ============================================================================
-- PARTE 2: GARANTIR QUE O TRIGGER handle_new_user EXISTE
-- ============================================================================

-- a) Dropar função antiga se houver problemas
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- b) Criar nova função que cria perfil básico quando usuário faz signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- c) Garantir que o trigger existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- PARTE 3: GARANTIR POLÍTICAS RLS CORRETAS
-- ============================================================================

-- a) POLITICA SELECT: Usuário vê seu próprio perfil completo
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON profiles;
CREATE POLICY "Usuários podem ver seu próprio perfil"
ON profiles
FOR SELECT
USING (auth.uid() = id);

-- b) POLÍTICA SELECT: Usuários autenticados veem nomes de colecionadores
DROP POLICY IF EXISTS "Usuários podem ver nomes de colecionadores" ON profiles;
CREATE POLICY "Usuários podem ver nomes de colecionadores"
ON profiles
FOR SELECT
USING (true);  -- Qualquer um autenticado pode ver nomes

-- c) POLÍTICA UPDATE: Usuário atualiza seu próprio perfil
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON profiles;
CREATE POLICY "Usuários podem atualizar seu próprio perfil"
ON profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- d) POLÍTICA DELETE: Usuário deleta seu próprio perfil
DROP POLICY IF EXISTS "Usuários podem deletar seu próprio perfil" ON profiles;
CREATE POLICY "Usuários podem deletar seu próprio perfil"
ON profiles
FOR DELETE
USING (auth.uid() = id);

-- ============================================================================
-- PARTE 4: VERIFICAÇÃO FINAL
-- ============================================================================

-- Verificar que RLS está ativado
-- SELECT tablename FROM pg_tables WHERE tablename='profiles' AND schemaname='public';

-- Verificar que trigger handle_new_user existe
-- SELECT trigger_name FROM information_schema.triggers 
-- WHERE event_object_table = 'profiles' AND trigger_name = 'on_auth_user_created';

-- Verificar que não há política INSERT
-- SELECT policyname, permissive, cmd FROM pg_policies 
-- WHERE tablename = 'profiles' AND cmd = 'INSERT';
-- Resultado esperado: (sem resultados / resultados vazios)

-- ============================================================================
-- RESULTADO ESPERADO
-- ============================================================================
-- ✅ Usuário faz signup (email + senha)
-- ✅ Trigger cria perfil básico automaticamente
-- ✅ Sistema envia código de verificação
-- ✅ Usuário confirma email (verifica código)
-- ✅ Sistema redireciona para /complete-signup
-- ✅ Usuário preenche CPF/CNPJ e RG
-- ✅ Sistema atualiza perfil com sucesso (política UPDATE permite)
-- ✅ Usuário é redirecionado para /portal

-- ============================================================================

-- ============================================================================
-- CORRIGIR: Atualizar função handle_new_user para inserir email também
-- ============================================================================

-- 1. Dropar a função antiga se existir
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 2. Criar nova função que INSERE EMAIL (obrigatório!)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,  -- ← ADICIONADO: email do auth.users
    new.raw_user_meta_data->>'full_name'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Garantir que o trigger existe e está correto
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================

SELECT 
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND event_object_table = 'profiles';

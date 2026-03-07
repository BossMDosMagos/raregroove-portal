-- ========================================
-- FUNÇÃO: DELETAR USUÁRIO COMPLETAMENTE
-- ========================================
-- Esta função permite que admins deletem usuários
-- tanto da tabela profiles quanto do auth.users
-- Execute no Supabase SQL Editor

-- 1) Criar função para deletar usuário do auth também
CREATE OR REPLACE FUNCTION public.delete_user_completely(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Verificar se quem está executando é admin
  SELECT is_admin INTO v_is_admin
  FROM public.profiles
  WHERE id = auth.uid();
  
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem deletar usuários';
  END IF;
  
  -- Deletar do profiles (CASCADE vai deletar relacionados)
  DELETE FROM public.profiles WHERE id = user_id;
  
  -- Retornar sucesso (o auth.users será deletado via CASCADE se configurado)
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao deletar usuário: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2) Dar permissão de execução para usuários autenticados
GRANT EXECUTE ON FUNCTION public.delete_user_completely(UUID) TO authenticated;

-- ========================================
-- NOTA IMPORTANTE
-- ========================================
-- Para deletar o usuário do auth.users também, você precisa:
-- 1. Usar o Supabase Admin API no código JavaScript
-- 2. Ou configurar ON DELETE CASCADE na foreign key profiles.id → auth.users.id
--
-- A função JavaScript no AdminUsers.jsx vai usar:
-- const { error } = await supabase.auth.admin.deleteUser(userId)

-- ============================================================================
-- CONSULTA: Verificar usuários órfãos (existem em auth.users mas não em profiles)
-- Execute este SQL para ver quais usuários estão "quebrados"
-- ============================================================================

-- 1. Ver todos os usuários órfãos (deletados do painel admin mas ainda em auth.users)
SELECT 
  u.id,
  u.email,
  u.created_at as "Cadastrado em",
  u.last_sign_in_at as "Último login",
  'ÓRFÃO - Existe em auth.users mas não em profiles' as status
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL
ORDER BY u.created_at DESC;

-- 2. Ver todos os perfis completos (auth.users + profiles)
SELECT 
  u.id,
  u.email,
  p.full_name,
  p.cpf_cnpj,
  'COMPLETO - Existe em ambas as tabelas' as status
FROM auth.users u
INNER JOIN profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

-- ============================================================================
-- INTERPRETAÇÃO DOS RESULTADOS:
-- ============================================================================
-- ÓRFÃOS: Foram deletados via painel admin ANTES da correção
--         → Precisam ser limpos com SQL-FIX-USUARIO-ORFAO.sql
-- 
-- COMPLETOS: Estão funcionando normalmente
--            → Podem fazer login e usar o sistema
-- ============================================================================

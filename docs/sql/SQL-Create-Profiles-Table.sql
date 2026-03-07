/*
╔═════════════════════════════════════════════════════════════════════════════════╗
║                    CRIAÇÃO DA TABELA PROFILES - RAREGROOVE                      ║
║                     ⭐ EXECUTAR ISTO PRIMEIRO NO SUPABASE ⭐                     ║
╚═════════════════════════════════════════════════════════════════════════════════╝

⚠️  AVISO: Este script vai DESATIVAR RLS, DELETAR a tabela antiga e recriar do zero.
   Se você tiver dados importantes, FAÇA BACKUP PRIMEIRO!

INSTRUÇÕES:
1. Ir em Supabase Dashboard → SQL Editor
2. Copiar TODO o conteúdo deste arquivo
3. Colar no SQL Editor
4. Clicar em "Run" ou Ctrl+Enter
5. Esperar a mensagem "Success ✅"

DEPOIS execute: SQL-RLS-Policies.sql para ativar segurança

*/

-- 1. DESATIVAR RLS temporariamente para poder recriar a tabela
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 2. DELETAR todas as políticas existentes
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Usuários podem ver nomes de colecionadores" ON profiles;
DROP POLICY IF EXISTS "Usuários autenticados veem nomes públicos" ON profiles;
DROP POLICY IF EXISTS "Usuários podem criar seu próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Ninguém pode deletar perfis" ON profiles;

-- 3. DELETAR tabela antiga se existir
DROP TABLE IF EXISTS profiles CASCADE;

-- 4. CRIAR tabela de perfis de usuários COM TODAS AS COLUNAS
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  cpf TEXT,
  phone TEXT,
  cep TEXT,
  address TEXT,
  number TEXT,
  complement TEXT,
  city TEXT,
  state TEXT,
  pix_key TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. CRIAR índices para performance
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_created_at ON profiles(created_at);

-- 6. COMENTÁRIOS informativos
COMMENT ON TABLE profiles IS 'Tabela de perfis de usuários com dados cadastrais e sensíveis (CPF, PIX) protegidos por RLS';
COMMENT ON COLUMN profiles.cpf IS 'CPF do usuário - SENSÍVEL - protegido por RLS';
COMMENT ON COLUMN profiles.pix_key IS 'Chave PIX do usuário - SENSÍVEL - protegido por RLS';
COMMENT ON COLUMN profiles.phone IS 'Telefone do usuário - pode ser considerado SEMI-SENSÍVEL';

-- 7. Confirmação
SELECT 'Tabela profiles criada com sucesso! ✅ Agora execute SQL-RLS-Policies.sql' as resultado;

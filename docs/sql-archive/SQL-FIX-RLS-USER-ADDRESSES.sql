-- Fix RLS para permitir leitura de endereços para shipping
-- O sistema precisa ler endereços de QUALQUER usuário para gerar etiquetas

-- 1. Verificar policies existentes
SELECT schemaname, tablename, policyname, qual, with_check
FROM pg_policies
WHERE tablename = 'user_addresses';

-- 2. Adicionar política de SELECT para leitura pública (necessário para etiquetas)
-- Esta política permite que qualquer usuário autenticado LEIA endereços de qualquer outro usuário
-- Isso é necessário para que o sistema de shipping funcione corretamente
ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;

-- Deletar policies antigas se existirem
DROP POLICY IF EXISTS "Users can read their own addresses" ON user_addresses;
DROP POLICY IF EXISTS "Users can insert their own addresses" ON user_addresses;
DROP POLICY IF EXISTS "Users can update their own addresses" ON user_addresses;
DROP POLICY IF EXISTS "Users can delete their own addresses" ON user_addresses;

-- Policy: Qualquer usuário autenticado pode LER qualquer endereço
-- (necessário para gerar etiquetas com dados do comprador e vendedor)
CREATE POLICY "Authenticated users can read any address" ON user_addresses
FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy: Usuário só pode INSERIR seus próprios endereços
CREATE POLICY "Users can insert their own addresses" ON user_addresses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Usuário só pode ATUALIZAR seus próprios endereços
CREATE POLICY "Users can update their own addresses" ON user_addresses
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Usuário só pode DELETAR seus próprios endereços
CREATE POLICY "Users can delete their own addresses" ON user_addresses
FOR DELETE
USING (auth.uid() = user_id);

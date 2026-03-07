-- ============================================================================
-- PERMITIR LEITURA PÚBLICA DE PLATFORM_SETTINGS
-- ============================================================================
-- Problema: O console mostra "Platform Settings Data: null" porque usuários 
-- comuns não conseguem ler a tabela devido ao RLS
-- Solução: Criar política que permite leitura pública das configurações

-- 1. Ver políticas atuais
SELECT 
  policyname,
  cmd as "Comando",
  CASE 
    WHEN cmd = 'SELECT' THEN '✅ Leitura'
    WHEN cmd = 'INSERT' THEN '➕ Inserção'
    WHEN cmd = 'UPDATE' THEN '✏️ Atualização'
    WHEN cmd = 'DELETE' THEN '🗑️ Exclusão'
    ELSE 'Todos'
  END as "Tipo"
FROM pg_policies
WHERE tablename = 'platform_settings'
ORDER BY cmd;

-- 2. CRIAR OU SUBSTITUIR POLÍTICA DE LEITURA PÚBLICA
DROP POLICY IF EXISTS "Permitir leitura pública" ON platform_settings;
DROP POLICY IF EXISTS "Public read access" ON platform_settings;
DROP POLICY IF EXISTS "Allow public read" ON platform_settings;

CREATE POLICY "Permitir leitura pública"
  ON platform_settings
  FOR SELECT
  USING (true);  -- Permite que qualquer um leia (mesmo não autenticado)

-- 3. Confirmar criação
SELECT 
  '✅ Política de leitura pública criada' as status,
  COUNT(*) as "Total de Políticas SELECT"
FROM pg_policies
WHERE tablename = 'platform_settings' AND cmd = 'SELECT';

-- 4. Testar leitura (deve retornar dados agora)
SELECT 
  id,
  gateway_mode,
  gateway_provider,
  '✅ Leitura OK' as status
FROM platform_settings
ORDER BY id
LIMIT 1;

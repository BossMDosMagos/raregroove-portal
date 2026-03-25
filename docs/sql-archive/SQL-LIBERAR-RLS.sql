-- ============================================================================
-- LIBERAR LEITURA DA TABELA PLATFORM_SETTINGS (RLS)
-- ============================================================================

-- 1. Remover políticas antigas que podem estar bloqueando
DROP POLICY IF EXISTS "Public read access" ON platform_settings;
DROP POLICY IF EXISTS "Allow public read" ON platform_settings;
DROP POLICY IF EXISTS "Permitir leitura pública" ON platform_settings;

-- 2. CRIAR NOVA POLÍTICA DE LEITURA PÚBLICA
CREATE POLICY "Permitir leitura publica de settings"
  ON platform_settings
  FOR SELECT
  USING (true);

-- 3. CONFIRMAR POLÍTICAS
SELECT 
  '✅ RLS Liberado' as status,
  COUNT(*) as "Políticas SELECT",
  STRING_AGG(policyname, ', ') as "Nomes"
FROM pg_policies
WHERE tablename = 'platform_settings' 
  AND cmd = 'SELECT';

-- 4. TESTE DE LEITURA
SELECT 
  '✅ Leitura funcionando' as status,
  id,
  gateway_mode,
  gateway_provider
FROM platform_settings
LIMIT 1;

-- =============================================================================
-- FIX RLS - PLATFORM SETTINGS - PERMITIR INSERT PARA ADMINS
-- Data: 25/02/2026
-- =============================================================================
-- Problema: Falta política de INSERT para admins
-- Solução: Adicionar política permitindo admins inserirem configurações
-- =============================================================================

-- Adicionar política de INSERT para admins
DROP POLICY IF EXISTS "Admins inserem settings" ON public.platform_settings;
CREATE POLICY "Admins inserem settings"
  ON public.platform_settings
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  ));

-- Verificar políticas ativas
SELECT 
  schemaname,
  tablename, 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'platform_settings'
ORDER BY cmd, policyname;

-- Mensagem de sucesso
SELECT '✅ Política de INSERT para admins criada com sucesso' AS status;

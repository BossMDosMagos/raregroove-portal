-- =============================================================================
-- RAREGROOVE | FIX RLS DELETE DE SWAPS PARA ADMIN
-- Data: 2026-03-05
-- =============================================================================

BEGIN;

ALTER TABLE public.swaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins deletam swaps" ON public.swaps;
CREATE POLICY "Admins deletam swaps"
  ON public.swaps
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user(auth.uid()));

COMMIT;

-- Verificação rápida:
-- SELECT policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'swaps';

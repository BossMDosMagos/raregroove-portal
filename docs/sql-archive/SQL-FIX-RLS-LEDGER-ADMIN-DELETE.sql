-- =============================================================================
-- RAREGROOVE | FIX RLS DELETE DE FINANCIAL_LEDGER PARA ADMIN
-- Data: 2026-03-05
-- =============================================================================

BEGIN;

ALTER TABLE public.financial_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins deletam ledger" ON public.financial_ledger;
CREATE POLICY "Admins deletam ledger"
  ON public.financial_ledger
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user(auth.uid()));

COMMIT;

-- Verificação rápida:
-- SELECT policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'financial_ledger';

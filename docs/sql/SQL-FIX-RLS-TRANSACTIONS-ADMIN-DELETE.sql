-- =============================================================================
-- RAREGROOVE | FIX RLS DELETE DE TRANSACTIONS PARA ADMIN
-- Data: 2026-03-05
-- =============================================================================

BEGIN;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins deletam transações" ON public.transactions;
CREATE POLICY "Admins deletam transações"
  ON public.transactions
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user(auth.uid()));

COMMIT;

-- Verificação rápida:
-- SELECT policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'transactions';

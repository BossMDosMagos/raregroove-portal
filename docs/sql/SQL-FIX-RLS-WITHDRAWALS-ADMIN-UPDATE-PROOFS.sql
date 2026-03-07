-- =============================================================================
-- RAREGROOVE | FIX RLS UPDATE DE COMPROVANTES EM WITHDRAWALS PARA ADMIN
-- Data: 2026-03-05
-- =============================================================================

BEGIN;

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins atualizam comprovantes de saque" ON public.withdrawals;
CREATE POLICY "Admins atualizam comprovantes de saque"
  ON public.withdrawals
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

COMMIT;

-- Verificação rápida:
-- SELECT policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'withdrawals';

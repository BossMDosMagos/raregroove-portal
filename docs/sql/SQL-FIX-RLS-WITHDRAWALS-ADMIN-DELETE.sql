-- =============================================================================
-- RAREGROOVE | FIX RLS DELETE EM WITHDRAWALS PARA ADMIN
-- Data: 2026-03-05
-- Propósito: Permitir que administradores deletem solicitações de saque
-- =============================================================================

BEGIN;

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins deletam solicitações de saque" ON public.withdrawals;
CREATE POLICY "Admins deletam solicitações de saque"
  ON public.withdrawals
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user(auth.uid()));

COMMIT;

-- Verificação rápida:
-- SELECT policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'withdrawals';


-- =====================================================================
-- RETENÇÃO DE COMPROVANTES DE SAQUE (30 DIAS)
-- =====================================================================
-- Objetivos:
-- 1) Vincular comprovante ao usuário dono da solicitação
-- 2) Manter cópia administrativa para lista de liberação
-- 3) Auto-delete do processo após 30 dias

-- 1) Colunas adicionais para suportar cópia admin + expiração
ALTER TABLE withdrawals
  ADD COLUMN IF NOT EXISTS admin_proof_file_path text,
  ADD COLUMN IF NOT EXISTS proof_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_withdrawals_proof_expires_at
  ON withdrawals(proof_expires_at)
  WHERE proof_expires_at IS NOT NULL;

COMMENT ON COLUMN withdrawals.proof_file_path IS 'Cópia do comprovante vinculada ao usuário solicitante';
COMMENT ON COLUMN withdrawals.admin_proof_file_path IS 'Cópia administrativa do comprovante para lista de liberação';
COMMENT ON COLUMN withdrawals.proof_expires_at IS 'Data de expiração para auto-delete dos comprovantes (30 dias)';

-- 2) Policies de storage para o bucket withdrawal_proofs
--    Estrutura de paths:
--    users/{user_id}/withdrawals/{withdrawal_id}/proof_{timestamp}.ext
--    admin_archive/{withdrawal_id}/user_{user_id}_{timestamp}.ext

-- Garantir bucket de comprovantes
INSERT INTO storage.buckets (id, name, public)
VALUES ('withdrawal_proofs', 'withdrawal_proofs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users leem seus comprovantes de saque" ON storage.objects;
DROP POLICY IF EXISTS "Admins gerenciam comprovantes de saque" ON storage.objects;

CREATE POLICY "Users leem seus comprovantes de saque"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'withdrawal_proofs'
    AND split_part(name, '/', 1) = 'users'
    AND split_part(name, '/', 2) = auth.uid()::text
  );

CREATE POLICY "Admins gerenciam comprovantes de saque"
  ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'withdrawal_proofs'
    AND auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true)
  )
  WITH CHECK (
    bucket_id = 'withdrawal_proofs'
    AND auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true)
  );

-- 3) Função de limpeza (remove arquivos do storage e metadados expirados)
CREATE OR REPLACE FUNCTION cleanup_expired_withdrawal_proofs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cleaned_rows integer := 0;
BEGIN
  -- Remove arquivos expirados no storage
  DELETE FROM storage.objects so
  USING withdrawals w
  WHERE so.bucket_id = 'withdrawal_proofs'
    AND w.proof_expires_at IS NOT NULL
    AND w.proof_expires_at <= now()
    AND (
      so.name = w.proof_file_path
      OR so.name = w.admin_proof_file_path
    );

  -- Limpa referências do processo expirado
  UPDATE withdrawals
  SET
    proof_file_path = NULL,
    admin_proof_file_path = NULL,
    proof_original_filename = NULL,
    proof_expires_at = NULL
  WHERE proof_expires_at IS NOT NULL
    AND proof_expires_at <= now();

  GET DIAGNOSTICS cleaned_rows = ROW_COUNT;
  RETURN cleaned_rows;
END;
$$;

-- 4) Agendamento diário automático (03:10) se pg_cron estiver disponível
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup-withdrawal-proofs-30d');
    PERFORM cron.schedule(
      'cleanup-withdrawal-proofs-30d',
      '10 3 * * *',
      'SELECT cleanup_expired_withdrawal_proofs();'
    );
  END IF;
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron não disponível; execute cleanup_expired_withdrawal_proofs() manualmente via job externo.';
END;
$$;

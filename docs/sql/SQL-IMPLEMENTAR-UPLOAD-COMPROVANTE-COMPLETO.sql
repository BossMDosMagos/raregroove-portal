-- =====================================================================
-- SCRIPT DE IMPLEMENTAÇÃO: Upload de Comprovante de Pagamento
-- =====================================================================
-- Execute este script no SQL Editor do Supabase

-- 1. Adicionar colunas à tabela withdrawals
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS proof_file_path text;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS proof_original_filename text;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS admin_proof_file_path text;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS proof_expires_at timestamptz;

-- 2. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_withdrawals_proof_file_path 
ON withdrawals(proof_file_path) 
WHERE proof_file_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_withdrawals_proof_expires_at
ON withdrawals(proof_expires_at)
WHERE proof_expires_at IS NOT NULL;

-- 3. Adicionar comentários para documentação
COMMENT ON COLUMN withdrawals.proof_file_path IS 'Caminho do arquivo de comprovante armazenado no Supabase Storage (bucket: withdrawal_proofs)';
COMMENT ON COLUMN withdrawals.proof_original_filename IS 'Nome do arquivo original do comprovante enviado pelo admin';
COMMENT ON COLUMN withdrawals.admin_proof_file_path IS 'Cópia administrativa do comprovante para lista de liberação';
COMMENT ON COLUMN withdrawals.proof_expires_at IS 'Data de expiração do comprovante para limpeza automática (30 dias)';

-- 4. Atualizar função process_withdrawal para validar comprovante
CREATE OR REPLACE FUNCTION process_withdrawal(
  withdrawal_uuid uuid,
  new_status text,
  admin_notes text DEFAULT NULL,
  proof_user_path text DEFAULT NULL,
  proof_admin_path text DEFAULT NULL,
  proof_filename text DEFAULT NULL,
  proof_expires_at timestamptz DEFAULT NULL
)
RETURNS TABLE(
  success boolean,
  message text
) AS $$
DECLARE
  withdrawal_record record;
  user_balance decimal;
  v_proof_expires_at timestamptz := proof_expires_at;
BEGIN
  IF new_status NOT IN ('concluido', 'cancelado') THEN
    RETURN QUERY SELECT false, 'Status inválido. Use: concluido ou cancelado';
    RETURN;
  END IF;
  
  SELECT * INTO withdrawal_record
  FROM withdrawals
  WHERE id = withdrawal_uuid;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Saque não encontrado';
    RETURN;
  END IF;
  
  IF withdrawal_record.status IN ('concluido', 'cancelado') THEN
    RETURN QUERY SELECT false, 'Este saque já foi processado';
    RETURN;
  END IF;
  
  IF new_status = 'concluido' THEN
    SELECT saldo_disponivel INTO user_balance
    FROM get_user_financials(withdrawal_record.user_id);
    
    IF user_balance < withdrawal_record.amount THEN
      RETURN QUERY SELECT false, 'Usuário não tem mais saldo suficiente';
      RETURN;
    END IF;

    IF proof_user_path IS NULL OR proof_user_path = '' OR proof_admin_path IS NULL OR proof_admin_path = '' THEN
      RETURN QUERY SELECT false, 'Comprovante do PIX é obrigatório';
      RETURN;
    END IF;
    
    UPDATE withdrawals
    SET 
      status = 'concluido',
      processed_at = now(),
      proof_file_path = proof_user_path,
      admin_proof_file_path = proof_admin_path,
      proof_original_filename = COALESCE(proof_filename, proof_original_filename),
      proof_expires_at = COALESCE(v_proof_expires_at, now() + interval '30 days'),
      notes = 'Saque aprovado e processado com comprovante'
    WHERE id = withdrawal_uuid;

    INSERT INTO notifications (user_id, type, title, message)
    VALUES (
      withdrawal_record.user_id,
      'system',
      'Saque aprovado',
      'Seu saque foi aprovado e processado. O comprovante ficará disponível por 30 dias.'
    );
    
    INSERT INTO financial_ledger (
      source_type,
      source_id,
      entry_type,
      amount,
      user_id,
      metadata
    ) VALUES (
      'saque',
      withdrawal_uuid,
      'saque_aprovado',
      withdrawal_record.amount,
      withdrawal_record.user_id,
      jsonb_build_object(
        'pix_key', withdrawal_record.pix_key,
        'proof_file_user', proof_user_path,
        'proof_file_admin', proof_admin_path,
        'proof_filename', proof_filename,
        'proof_expires_at', COALESCE(v_proof_expires_at, now() + interval '30 days')
      )
    );
    
    RETURN QUERY SELECT true, '✅ Saque aprovado e processado com sucesso!';
    
  ELSE
    UPDATE withdrawals
    SET 
      status = 'cancelado',
      processed_at = now(),
      notes = COALESCE(admin_notes, 'Saque cancelado pelo administrador')
    WHERE id = withdrawal_uuid;

    INSERT INTO financial_ledger (
      source_type,
      source_id,
      entry_type,
      amount,
      user_id,
      metadata
    ) VALUES (
      'saque',
      withdrawal_uuid,
      'saque_cancelado',
      withdrawal_record.amount,
      withdrawal_record.user_id,
      jsonb_build_object(
        'pix_key', withdrawal_record.pix_key,
        'motivo', COALESCE(admin_notes, 'Sem motivo especificado')
      )
    );
    
    RETURN QUERY SELECT true, '❌ Saque cancelado';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Configurar políticas RLS para o bucket withdrawal_proofs
-- Garantir que o bucket exista
INSERT INTO storage.buckets (id, name, public)
VALUES ('withdrawal_proofs', 'withdrawal_proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Politicas de acesso ao bucket
DROP POLICY IF EXISTS "Admins veem comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Admins fazem upload de comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Admins deletam comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Users leem seus comprovantes de saque" ON storage.objects;

CREATE POLICY "Admins veem comprovantes"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'withdrawal_proofs' 
    AND auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true)
  );

CREATE POLICY "Admins fazem upload de comprovantes"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'withdrawal_proofs'
    AND auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true)
  );

CREATE POLICY "Admins deletam comprovantes"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'withdrawal_proofs'
    AND auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true)
  );

CREATE POLICY "Users leem seus comprovantes de saque"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'withdrawal_proofs'
    AND split_part(name, '/', 1) = 'users'
    AND split_part(name, '/', 2) = auth.uid()::text
  );

-- 6. Auto-delete do processo após 30 dias
CREATE OR REPLACE FUNCTION cleanup_expired_withdrawal_proofs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cleaned_rows integer := 0;
BEGIN
  DELETE FROM storage.objects so
  USING withdrawals w
  WHERE so.bucket_id = 'withdrawal_proofs'
    AND w.proof_expires_at IS NOT NULL
    AND w.proof_expires_at <= now()
    AND (
      so.name = w.proof_file_path
      OR so.name = w.admin_proof_file_path
    );

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

-- 7. Verificar se tudo foi executado com sucesso
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'withdrawals' 
  AND column_name IN ('proof_file_path', 'admin_proof_file_path', 'proof_original_filename', 'proof_expires_at')
ORDER BY ordinal_position;

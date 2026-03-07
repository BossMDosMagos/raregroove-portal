-- HOTFIX: column reference "proof_expires_at" is ambiguous
-- Execute este arquivo no SQL Editor do Supabase

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

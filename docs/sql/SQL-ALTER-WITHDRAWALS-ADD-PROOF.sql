-- =====================================================================
-- ALTER TABLE: Adicionar coluna de comprovante ao saque
-- =====================================================================

-- Adicionar coluna proof_file_path se não existir
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS proof_file_path text;

-- Adicionar coluna para armazenar caminho do arquivo original se necessário
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS proof_original_filename text;

-- Adicionar coluna para cópia administrativa e retenção
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS admin_proof_file_path text;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS proof_expires_at timestamptz;

-- Criar índice para agilizar buscas
CREATE INDEX IF NOT EXISTS idx_withdrawals_proof_file_path 
ON withdrawals(proof_file_path) 
WHERE proof_file_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_withdrawals_proof_expires_at
ON withdrawals(proof_expires_at)
WHERE proof_expires_at IS NOT NULL;

-- Comentar as colunas para documentação
COMMENT ON COLUMN withdrawals.proof_file_path IS 'Caminho do arquivo de comprovante armazenado no Supabase Storage (withdrawal_proofs bucket)';
COMMENT ON COLUMN withdrawals.proof_original_filename IS 'Nome do arquivo original do comprovante enviado pelo admin';
COMMENT ON COLUMN withdrawals.admin_proof_file_path IS 'Cópia administrativa do comprovante para lista de liberação';
COMMENT ON COLUMN withdrawals.proof_expires_at IS 'Data de expiração para limpeza automática dos comprovantes';

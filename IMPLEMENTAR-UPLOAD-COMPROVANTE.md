# 🔧 Instruções para Implementar Upload de Comprovante de Pagamento

## ✅ O que foi implementado

1. **Nova função de upload** (`uploadWithdrawalProof`) no arquivo `src/utils/profileService.js`
   - Valida tipos de arquivo (PDF, JPG, PNG, WebP, GIF)
   - Valida tamanho máximo (5MB)
   - Faz upload para o bucket `withdrawal_proofs`

2. **Modal atualizado** no arquivo `src/pages/AdminDashboard.jsx`
   - Substituído campo de texto por upload de arquivo
   - Adicionado preview de imagens
   - Validação de arquivo obrigatório antes de aprovar

3. **Função SQL atualizada** no arquivo `SQL-CREATE-PROCESS-WITHDRAWAL.sql`
   - Agora exige comprovante para aprovar saques
   - Armazena caminho do arquivo na coluna `proof_file_path`
   - Registra no ledger com informações do comprovante

4. **Colunas novas na tabela** (script `SQL-ALTER-WITHDRAWALS-ADD-PROOF.sql`)
   - `proof_file_path`: Caminho do arquivo armazenado
   - `proof_original_filename`: Nome original do arquivo

---

## 📋 Passos para Aplicar as Mudanças

### 1️⃣ Executar Script SQL para ALTER TABLE

Acesse seu banco de dados Supabase e execute o script:
```bash
SQL-ALTER-WITHDRAWALS-ADD-PROOF.sql
```

Ou execute diretamente no SQL Editor do Supabase:
```sql
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS proof_file_path text;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS proof_original_filename text;

CREATE INDEX IF NOT EXISTS idx_withdrawals_proof_file_path 
ON withdrawals(proof_file_path) 
WHERE proof_file_path IS NOT NULL;

COMMENT ON COLUMN withdrawals.proof_file_path IS 'Caminho do arquivo de comprovante armazenado no Supabase Storage';
COMMENT ON COLUMN withdrawals.proof_original_filename IS 'Nome do arquivo original do comprovante';
```

### 2️⃣ Atualizar a Função SQL

Execute o script atualizado:
```bash
SQL-CREATE-PROCESS-WITHDRAWAL.sql
```

### 3️⃣ Criar Bucket no Supabase Storage

```sql
-- Opção 1: Criar bucket via SQL (se seu Supabase suporta)
INSERT INTO storage.buckets (id, name, public)
VALUES ('withdrawal_proofs', 'withdrawal_proofs', false);
```

**OU**

**Opção 2: Criar manualmente via Dashboard do Supabase:**
1. Acesse **Storage** no Dashboard
2. Clique em **Create a new bucket**
3. Nome: `withdrawal_proofs`
4. Deixe como **PRIVATE** (não public)
5. Clique em **Create bucket**

### 4️⃣ Configurar Políticas de Segurança (RLS) do Bucket

Execute no SQL Editor do Supabase:

```sql
-- Permitir que admin veja todos os arquivos de comprovante
CREATE POLICY "Admins veem comprovantes"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'withdrawal_proofs' 
    AND auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );

-- Permitir que admin faça upload de comprovantes
CREATE POLICY "Admins fazem upload de comprovantes"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'withdrawal_proofs'
    AND auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );
```

---

## 🧪 Testar a Implementação

1. **Faça login como admin**
2. **Vá para a Dashboard de Pagamentos**
3. **Selecione um saque pendente**
4. **Tente aprovar SEM anexar arquivo** → Deve mostrar erro obrigatório
5. **Anexe um PDF ou imagem** → Deve aparecer preview/nome do arquivo
6. **Clique em APROVAR** → Deve fazer upload e processar

---

## 📝 Campos que foram atualizados

### `withdrawals` table
| Coluna | Tipo | Propósito |
|--------|------|----------|
| `proof_file_path` | text | Caminho do arquivo no Storage |
| `proof_original_filename` | text | Nome original do arquivo |
| `notes` | text | Observações do processamento |

### `financial_ledger` table
Agora armazena em `metadata`:
- `proof_file`: Caminho do arquivo de comprovante
- `pix_key`: Chave PIX usada na transação

---

## ⚠️ Problemas Frequentes

### Erro: "Bucket withdrawal_proofs não encontrado"
**Solução:** Criar o bucket manualmente via Dashboard do Supabase (veja passo 3️⃣)

### Erro: "Permission denied" ao fazer upload
**Solução:** Verificar as políticas RLS do bucket (veja passo 4️⃣)

### Arquivo não aparece após upload
**Solução:** Limpar cache do navegador (Ctrl+Shift+Del ou Cmd+Shift+Del)

---

## 🔐 Segurança

- Arquivos são armazenados como **PRIVATE** (não públicos)
- Apenas admins podem fazer upload
- Apenas admins podem visualizar
- Validação de tipo e tamanho no cliente E no servidor
- Nomes de arquivo são randomizados com timestamp

---

## 📚 Referências

- Código do componente: `src/pages/AdminDashboard.jsx` (WithdrawalProcessModal)
- Função de upload: `src/utils/profileService.js` (uploadWithdrawalProof)
- Função SQL: `SQL-CREATE-PROCESS-WITHDRAWAL.sql`

# 🔄 ANTES E DEPOIS - Mudanças de Código

---

## 1️⃣ AdminDashboard.jsx - Importações

### ❌ ANTES
```jsx
import { DollarSign, Shield, TrendingUp, Lock, CheckCircle, Loader2, Users, RefreshCw, Settings, BarChart3, Bug, CreditCard, AlertCircle, XCircle, Wallet, Copy, Download } from 'lucide-react';
```

### ✅ DEPOIS
```jsx
import { DollarSign, Shield, TrendingUp, Lock, CheckCircle, Loader2, Users, RefreshCw, Settings, BarChart3, Bug, CreditCard, AlertCircle, XCircle, Wallet, Copy, Download, Upload, X } from 'lucide-react';
import { uploadWithdrawalProof } from '../utils/profileService';
```

**O que mudou:**
- ➕ Adicionado ícone `Upload`
- ➕ Adicionado ícone `X`
- ➕ Importada função `uploadWithdrawalProof`

---

## 2️⃣ WithdrawalProcessModal - Estados

### ❌ ANTES
```jsx
function WithdrawalProcessModal({ isOpen, onClose, withdrawal, onSuccess }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [notes, setNotes] = useState('');

  if (!isOpen || !withdrawal) return null;
```

### ✅ DEPOIS
```jsx
function WithdrawalProcessModal({ isOpen, onClose, withdrawal, onSuccess }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [proofFile, setProofFile] = useState(null);
  const [proofFilePath, setProofFilePath] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen || !withdrawal) return null;
```

**O que mudou:**
- ❌ Removido `notes` (texto)
- ➕ Adicionado `proofFile` (arquivo)
- ➕ Adicionado `proofFilePath` (caminho após upload)
- ➕ Adicionado `fileInputRef` (ref para input)

---

## 3️⃣ handleProcess - Lógica Principal

### ❌ ANTES
```jsx
const handleProcess = async (newStatus) => {
  if (!['concluido', 'cancelado'].includes(newStatus)) return;

  if (newStatus === 'concluido' && !notes.trim()) {
    toast.error('COMPROVANTE OBRIGATÓRIO', {
      description: 'Preencha o campo de observação com os dados do comprovante PIX antes de aprovar.',
      style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
    });
    return;
  }

  // ... resto do código ...

  try {
    const { data, error } = await supabase.rpc('process_withdrawal', {
      withdrawal_uuid: withdrawal.id,
      new_status: newStatus,
      admin_notes: notes.trim() || null
    });

    // ... resto do código ...
  }
```

### ✅ DEPOIS
```jsx
const handleProcess = async (newStatus) => {
  if (!['concluido', 'cancelado'].includes(newStatus)) return;

  // Exigir comprovante apenas quando aprovar (concluido)
  if (newStatus === 'concluido' && !proofFile) {
    toast.error('COMPROVANTE OBRIGATÓRIO', {
      description: 'Anexe o comprovante do PIX (PDF ou imagem) antes de aprovar o saque.',
      style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
    });
    return;
  }

  // ... resto do código ...

  try {
    let proofPath = null;

    // Se aprovar, fazer upload do comprovante
    if (newStatus === 'concluido' && proofFile) {
      proofPath = await uploadWithdrawalProof(withdrawal.id, proofFile);
      
      if (!proofPath) {
        setIsProcessing(false);
        return; // Erro no upload já foi mostrado por toast
      }
      
      setProofFilePath(proofPath);
    }

    // Chamar função SQL para processar o saque
    const { data, error } = await supabase.rpc('process_withdrawal', {
      withdrawal_uuid: withdrawal.id,
      new_status: newStatus,
      admin_notes: proofPath || null
    });

    // ... resto do código ...
  }
```

**O que mudou:**
- 🔄 Mudança: `!notes.trim()` → `!proofFile`
- 🔄 Mudança: `admin_notes: notes.trim()` → `admin_notes: proofPath`
- ➕ Novo: `uploadWithdrawalProof()` before RPC call

---

## 4️⃣ Interface - Campo de Observações → Upload

### ❌ ANTES
```jsx
{/* Campo de Observações */}
<div>
  <label className="block text-sm font-medium text-gray-300 mb-2">
    Comprovante do PIX (obrigatório para aprovação)
  </label>
  <textarea
    value={notes}
    onChange={(e) => setNotes(e.target.value)}
    placeholder="Ex: TXID, banco, horário e ID do comprovante"
    rows={3}
    className="w-full px-4 py-3 bg-black border border-[#D4AF37]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] transition-colors resize-none"
    disabled={isProcessing}
    required
  />
</div>
```

### ✅ DEPOIS
```jsx
{/* Campo de Comprovante do PIX - Upload de Arquivo */}
<div>
  <label className="block text-sm font-medium text-gray-300 mb-3">
    <Upload className="w-4 h-4 inline mr-2" />
    Comprovante do PIX (obrigatório para aprovação)
  </label>
  
  {!proofFile ? (
    <div
      onClick={() => fileInputRef.current?.click()}
      className="border-2 border-dashed border-[#D4AF37]/40 rounded-lg p-6 cursor-pointer hover:border-[#D4AF37]/60 hover:bg-[#D4AF37]/5 transition-all text-center"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.gif"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            setProofFile(e.target.files[0]);
          }
        }}
        className="hidden"
        disabled={isProcessing}
      />
      <Upload className="w-8 h-8 text-[#D4AF37]/60 mx-auto mb-2" />
      <p className="text-white font-semibold mb-1">Selecione o comprovante</p>
      <p className="text-gray-400 text-xs">PDF, JPG, PNG, WebP ou GIF (máx. 5MB)</p>
    </div>
  ) : (
    <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="bg-[#D4AF37]/20 rounded p-2 mt-1">
            {proofFile.type.startsWith('image/') ? (
              <span className="text-lg">🖼️</span>
            ) : (
              <span className="text-lg">📄</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold truncate">{proofFile.name}</p>
            <p className="text-gray-400 text-xs">
              {(proofFile.size / 1024).toFixed(2)} KB
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setProofFile(null);
            setProofFilePath(null);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          }}
          disabled={isProcessing}
          className="text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {proofFile.type.startsWith('image/') && (
        <div className="mt-3 pt-3 border-t border-[#D4AF37]/20">
          <img
            src={URL.createObjectURL(proofFile)}
            alt="Preview"
            className="max-h-40 rounded mx-auto object-contain"
          />
        </div>
      )}
    </div>
  )}
</div>
```

**O que mudou:**
- ❌ Removido: `<textarea>`
- ➕ Adicionado: Upload area com drag-and-drop styling
- ➕ Adicionado: Preview de arquivo (nome + tamanho)
- ➕ Adicionado: Preview visual de imagem
- ➕ Adicionado: Botão para remover arquivo

---

## 5️⃣ profileService.js - Nova Função

### ❌ ANTES (fim do arquivo)
```javascript
export const removeAvatar = async (userId) => {
  // ... código anterior ...
};
// FIM DO ARQUIVO
```

### ✅ DEPOIS (fim do arquivo)
```javascript
export const removeAvatar = async (userId) => {
  // ... código anterior ...
};

/**
 * Faz upload de comprovante de PIX para processamento de saque
 * @param {string} withdrawalId - ID do saque
 * @param {File} file - Arquivo do comprovante (PDF ou imagem)
 * @returns {Promise<string|null>} Caminho do arquivo ou null se falhar
 */
export const uploadWithdrawalProof = async (withdrawalId, file) => {
  try {
    // Validar tipo de arquivo - aceita PDF e imagens
    const validTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif'
    ];
    if (!validTypes.includes(file.type)) {
      toast.error('Formato inválido. Use PDF, JPG, PNG, WebP ou GIF');
      return null;
    }

    // Validar tamanho (5MB max para comprovante)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error('Arquivo muito grande. Máximo: 5MB');
      return null;
    }

    // Caminho do arquivo: withdrawal_proofs/{withdrawalId}/proof.{ext}
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const filePath = `${withdrawalId}/proof_${timestamp}.${fileExt}`;

    // Upload do comprovante
    const { error: uploadError } = await supabase.storage
      .from('withdrawal_proofs')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Erro ao fazer upload do comprovante:', uploadError);
      toast.error('Erro ao fazer upload do comprovante');
      return null;
    }

    return filePath;
  } catch (error) {
    console.error('Erro no upload de comprovante:', error);
    toast.error('Erro ao fazer upload do comprovante');
    return null;
  }
};
```

**O que mudou:**
- ➕ Nova função completa com validações
- ✅ Tipo de arquivo (PDF/Imagem)
- ✅ Tamanho máximo (5MB)
- ✅ Upload para bucket storage

---

## 6️⃣ SQL - Função process_withdrawal

### ❌ ANTES
```sql
CREATE OR REPLACE FUNCTION process_withdrawal(
  withdrawal_uuid uuid,
  new_status text,
  admin_notes text DEFAULT NULL
)
-- ...
IF new_status = 'concluido' THEN
  -- ... 
  UPDATE withdrawals
  SET 
    status = 'concluido',
    processed_at = now(),
    notes = COALESCE(admin_notes, 'Saque aprovado e processado')
  WHERE id = withdrawal_uuid;

  INSERT INTO financial_ledger (
    -- ...
    metadata
  ) VALUES (
    -- ...
    jsonb_build_object(
      'pix_key', withdrawal_record.pix_key,
      'notes', admin_notes
    )
  );
```

### ✅ DEPOIS
```sql
CREATE OR REPLACE FUNCTION process_withdrawal(
  withdrawal_uuid uuid,
  new_status text,
  admin_notes text DEFAULT NULL
)
-- ...
IF new_status = 'concluido' THEN
  -- ... verificar saldo ...
  
  -- ✅ NOVO: Validar que o comprovante foi enviado
  IF admin_notes IS NULL OR admin_notes = '' THEN
    RETURN QUERY SELECT false, 'Comprovante do PIX é obrigatório';
    RETURN;
  END IF;
  
  UPDATE withdrawals
  SET 
    status = 'concluido',
    processed_at = now(),
    proof_file_path = admin_notes,  -- ✅ NOVO
    notes = 'Saque aprovado e processado com comprovante'
  WHERE id = withdrawal_uuid;

  INSERT INTO financial_ledger (
    -- ...
    metadata
  ) VALUES (
    -- ...
    jsonb_build_object(
      'pix_key', withdrawal_record.pix_key,
      'proof_file', admin_notes  -- ✅ NOVO
    )
  );
  
  -- ✅ NOVO: Registra metadata do saque aprovado
END IF;

-- ✅ NOVO: Registra também cancelamento
ELSE
  -- ...
  INSERT INTO financial_ledger (
    -- ...
    metadata
  ) VALUES (
    -- ...,
    jsonb_build_object(
      'pix_key', withdrawal_record.pix_key,
      'motivo', COALESCE(admin_notes, 'Sem motivo especificado')
    )
  );
```

**O que mudou:**
- ➕ Validação: `IF admin_notes IS NULL` → erro obrigatório
- ➕ Novo campo: `proof_file_path = admin_notes`
- ➕ Ledger: agora registra `proof_file` no metadata
- ➕ Cancelamento: também registra auditoria

---

## 7️⃣ Banco de Dados - Novas Colunas

### ❌ ANTES
```sql
CREATE TABLE withdrawals (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  amount decimal NOT NULL,
  status varchar NOT NULL,
  pix_key text NOT NULL,
  notes text,
  created_at timestamp DEFAULT now(),
  processed_at timestamp,
  -- ... outras colunas
);
```

### ✅ DEPOIS
```sql
CREATE TABLE withdrawals (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  amount decimal NOT NULL,
  status varchar NOT NULL,
  pix_key text NOT NULL,
  notes text,
  proof_file_path text,              -- ➕ NOVO
  proof_original_filename text,      -- ➕ NOVO
  created_at timestamp DEFAULT now(),
  processed_at timestamp,
  -- ... outras colunas
);

-- ➕ NOVO: Índice para performance
CREATE INDEX idx_withdrawals_proof_file_path 
ON withdrawals(proof_file_path) 
WHERE proof_file_path IS NOT NULL;
```

**O que mudou:**
- ➕ Nova coluna: `proof_file_path`
- ➕ Nova coluna: `proof_original_filename`
- ➕ Novo índice para queries rápidas

---

## 📊 Resumo de Mudanças

| Componente | Tipo de Mudança | Linhas |
|------------|-----------------|--------|
| AdminDashboard.jsx | Imports | +2 |
| AdminDashboard.jsx | Estados (useState) | 3 linhas |
| AdminDashboard.jsx | handleProcess | ~80% reescrito |
| AdminDashboard.jsx | UI (input file) | ~70 linhas |
| profileService.js | Nova função | ~50 linhas |
| SQL | Validação | +3 linhas |
| SQL | Metadata | +1 campo |
| SQL | Auditoria | +1 insert |
| Database | Novas colunas | +2 colunas |
| Database | Índice | +1 índice |

---

## ✨ Resultado Final

```
Uma mudança simples, mas com grande impacto:
❌ Texto solto (inseguro) →  ✅ Arquivo validado (seguro)
❌ Sem rastreio          →  ✅ Auditoria completa
❌ UX confuso            →  ✅ Interface clara
```

---

**Conclusão:** Todas as mudanças foram aplicadas com sucesso! 🎉

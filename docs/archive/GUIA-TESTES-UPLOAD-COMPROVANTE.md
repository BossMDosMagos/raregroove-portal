# 👨‍🔬 Guia de Testes - Upload de Comprovante PIX

## ✅ Checklist de Implementação

### Antes de Testar
- [ ] SQL script executado no Supabase
- [ ] Bucket `withdrawal_proofs` criado e configurado como PRIVATE
- [ ] Políticas RLS configuradas no bucket
- [ ] Front-end atualizado (AdminDashboard.jsx)
- [ ] Função `uploadWithdrawalProof` adicionada (profileService.js)
- [ ] Browser cache limpo

---

## 🧪 Testes Funcionais

### Teste 1: Validação de Arquivo Obrigatório
**Objetivo:** Garantir que não é possível aprovar sem comprovante

**Passos:**
1. Acesse Admin Dashboard
2. Selecione um saque pendente
3. Clique em **APROVAR SAQUE**
4. NÃO selecione nenhum arquivo
5. Clique no botão **APROVAR SAQUE** novamente

**Resultado Esperado:**
- ✅ Toast error com mensagem: "COMPROVANTE OBRIGATÓRIO"
- ✅ Modal não fecha
- ✅ Saque não é processado

---

### Teste 2: Seleção de Arquivo Válido (PDF)
**Objetivo:** Verificar upload de arquivo PDF

**Passos:**
1. Clique em **APROVAR SAQUE** (abre modal)
2. Clique na área de upload ou em "Selecione o comprovante"
3. Selecione um arquivo **PDF** válido (< 5MB)
4. Verifique o preview

**Resultado Esperado:**
- ✅ Arquivo aparece com ícone 📄
- ✅ Nome do arquivo é exibido
- ✅ Tamanho em KB é mostrado
- ✅ Botão X aparece para remover arquivo

---

### Teste 3: Seleção de Arquivo Válido (Imagem)
**Objetivo:** Verificar upload de imagem com preview

**Passos:**
1. Clique em **APROVAR SAQUE**
2. Selecione uma **imagem** (JPG, PNG, WebP, GIF) < 5MB
3. Verifique preview

**Resultado Esperado:**
- ✅ Arquivo aparece com ícone 🖼️
- ✅ Preview da imagem é exibido
- ✅ Nome e tamanho são mostrados

---

### Teste 4: Rejeitar Arquivo Inválido (Tipos)
**Objetivo:** Validar tipos de arquivo

**Passos:**
1. Clique em **APROVAR SAQUE**
2. Tente selecionar um arquivo **.DOCX**, **.XLSX** ou **.TXT**
3. Verifique se funciona

**Resultado Esperado:**
- ✅ Arquivo NÃO é aceito
- ✅ Toast error: "Formato inválido. Use PDF, JPG, PNG, WebP ou GIF"

---

### Teste 5: Rejeitar Arquivo Muito Grande
**Objetivo:** Validar limite de tamanho (5MB)

**Passos:**
1. Crie ou encontre um arquivo PDF/imagem **> 5MB**
2. Clique em **APROVAR SAQUE**
3. Tente selecionar esse arquivo

**Resultado Esperado:**
- ✅ Toast error: "Arquivo muito grande. Máximo: 5MB"
- ✅ Arquivo não é adicionado

---

### Teste 6: Remover Arquivo Selecionado
**Objetivo:** Verificar função de remover arquivo

**Passos:**
1. Selecione um arquivo válido
2. Veja o preview
3. Clique no botão **X** (canto direito)

**Resultado Esperado:**
- ✅ Arquivo é removido
- ✅ Interface volta ao estado de "Selecione o comprovante"
- ✅ Input file é limpo

---

### Teste 7: Aprovar Saque com Comprovante
**Objetivo:** Fluxo completo de aprovação

**Passos:**
1. Selecione um saque com saldo disponível
2. Clique em **APROVAR SAQUE**
3. Selecione um comprovante válido
4. Clique **APROVAR SAQUE**
5. Confirme no prompt do navegador

**Resultado Esperado:**
- ✅ Loading spinner aparece
- ✅ Toast success: "PAGAMENTO CONFIRMADO"
- ✅ Modal fecha
- ✅ Tabela é atualizada
- ✅ Saque agora mostra status "Concluído"

---

### Teste 8: Cancelar Saque (sem comprovante)
**Objetivo:** Cancelamento não requer arquivo

**Passos:**
1. Clique em **CANCELAR SAQUE**
2. Confirme no prompt
3. NÃO selecione arquivo

**Resultado Esperado:**
- ✅ Toast: "Saque cancelado"
- ✅ Modal fecha
- ✅ Status muda para "Cancelado"

---

### Teste 9: Banco de Dados - Verificar Armazenamento
**Objetivo:** Confirmar que dados foram salvos corretamente

**Passos:**
1. No Supabase, abra **SQL Editor**
2. Execute:
```sql
SELECT 
  id,
  user_id,
  amount,
  status,
  proof_file_path,
  processed_at
FROM withdrawals
WHERE status = 'concluido'
ORDER BY processed_at DESC
LIMIT 5;
```

**Resultado Esperado:**
- ✅ Coluna `proof_file_path` contém caminho tipo: `{withdrawal_id}/proof_{timestamp}.pdf`
- ✅ Campo `status` = 'concluido'
- ✅ Campo `processed_at` preenchido

---

### Teste 10: Storage - Verificar Arquivo Armazenado
**Objetivo:** Confirmar upload no Supabase Storage

**Passos:**
1. Acesse **Storage** no Supabase Dashboard
2. Abra bucket `withdrawal_proofs`
3. Procure pela pasta com o ID do saque
4. Verifique os arquivos

**Resultado Esperado:**
- ✅ Pasta com nome `{withdrawal_uuid}` existe
- ✅ Arquivo `proof_{timestamp}.{ext}` está presente
- ✅ Tamanho do arquivo corresponde ao original

---

### Teste 11: Auditoria - Ledger Financeiro
**Objetivo:** Validar registro de auditoria

**Passos:**
1. Execute SQL:
```sql
SELECT 
  id,
  source_type,
  entry_type,
  amount,
  metadata,
  created_at
FROM financial_ledger
WHERE source_type = 'saque'
  AND entry_type = 'saque_aprovado'
ORDER BY created_at DESC
LIMIT 5;
```

**Resultado Esperado:**
- ✅ `source_type` = 'saque'
- ✅ `entry_type` = 'saque_aprovado'
- ✅ `metadata` contém: `{"pix_key": "...", "proof_file": "..."}`

---

### Teste 12: Múltiplos Saques
**Objetivo:** Verificar que cada saque tem seu próprio arquivo

**Passos:**
1. Aprove 3 saques diferentes com comprovantes diferentes
2. Verifique no Storage que há 3 pastas diferentes

**Resultado Esperado:**
- ✅ Cada pasta contém seu próprio arquivo
- ✅ Nomes são únicos (com timestamps diferentes)

---

## 🔍 Testes de Segurança

### Teste S1: RLS - Admin Vê Comprovantes
**Objetivo:** Apenas admin consegue acessar arquivos

**Passos:**
1. Faça login como **ADMIN**
2. Tente acessar via S3/API (curl): `GET /withdrawal_proofs/{id}/...`

**Resultado Esperado:**
- ✅ Acesso permitido

**Teste S2: Usuário Normal NÃO consegue ver**
- Faça login como **USUÁRIO COMUM**
- Tente acessar mesmo arquivo

**Resultado Esperado:**
- ✅ Acesso negado (403 Forbidden)

---

### Teste S3: Validação de Tipo no Servidor
**Objetivo:** Mesmo se arquivo inválido passar do client, servidor rejeita

**Passos:**
1. Use DevTools para burlar validação client-side
2. Tente fazer upload de `.exe` ou `.zip`

**Resultado Esperado:**
- ✅ Toast error no front
- ✅ Arquivo não é processado

---

## 📊 Testes de Performance

### Teste P1: Upload de Arquivo Grande (5MB)
**Objetivo:** Verificar tempo de resposta

**Passos:**
1. Crie arquivo de exatamente 5MB
2. Selecione e aprove saque
3. Cronômetro: quando fecha até sucesso?

**Resultado Esperado:**
- ✅ Não mais que 10 segundos total
- ✅ Spinner de loading aparece

---

### Teste P2: Preview de Imagem Grande
**Objetivo:** Verificar renderização de imagem pesada

**Passos:**
1. Selecione imagem 5MB
2. Verifique se preview carrega sem travamento

**Resultado Esperado:**
- ✅ Preview aparece em < 2 segundos
- ✅ Interface não trava

---

## 🐛 Troubleshooting

| Erro | Causa | Solução |
|------|-------|---------|
| "Bucket não encontrado" | Bucket não criado | Criar manualmente em Storage |
| "Permission denied" | RLS não configurada | Executar SQL de policies |
| Arquivo não aparece | Cache | Ctrl+Shift+Del e F5 |
| "File too large" | Arquivo > 5MB | Selecionar arquivo menor |
| Modal não fecha | Erro no upload | Ver console (F12) para erro |
| Arquivo perde input | Refresh do browser | Selecionar novamente |

---

## ✅ Conclusão

Após passar em todos os testes acima, a implementação está **COMPLETA E VALIDADA**.

**Status:** ✅ PRONTO PARA PRODUÇÃO

🔧 FLUXO DE SAQUES - GUIA COMPLETO
=====================================

## 📊 VISÃO GERAL DO SISTEMA:

O sistema agora possui **gestão completa** de solicitações de saque:

1. **Usuário Vendedor**: Solicita saque do saldo disponível
2. **Sistema**: Valida e cria registro na tabela `withdrawals`
3. **Administrador**: Vê solicitações pendentes no cofre central
4. **Administrador**: Aprova ou cancela o saque
5. **Sistema**: Registra no ledger financeiro

---

## ✅ O QUE FOI IMPLEMENTADO:

### 1️⃣ SQL - Função de Processamento (SQL-CREATE-PROCESS-WITHDRAWAL.sql)

**Arquivo criado:** `SQL-CREATE-PROCESS-WITHDRAWAL.sql`

**O que faz:**
- Função `process_withdrawal()` para admin aprovar/rejeitar saques
- Valida se saque ainda está pendente
- Revalida saldo do usuário ao aprovar
- Registra movimentação no `financial_ledger`
- Atualiza status e data de processamento

**Status possíveis:**
- `pendente` → Aguardando aprovação admin
- `concluido` → Aprovado e pago
- `cancelado` → Rejeitado pelo admin

---

### 2️⃣ Frontend - AdminDashboard.jsx

**Modificações:**
1. **Estado adicionado:**
   - `withdrawals` → Lista de saques
   - `selectedWithdrawal` → Saque sendo processado

2. **Fetch de dados:**
   - Busca todos os saques com join em `profiles`
   - Traz nome do usuário e e-mail

3. **Nova seção visual:**
   - Tabela de solicitações de saque
   - Contador de pendentes e total
   - Botão "PROCESSAR" para cada saque pendente

4. **Modal de processamento:**
   - Exibe informações completas do saque
   - Campo de observações para admin
   - Botões: "CANCELAR SAQUE" e "APROVAR SAQUE"
   - Confirmação de segurança antes de processar

---

## 🧪 COMO TESTAR:

### PASSO 1: Execute o SQL no Supabase

1. Acesse Supabase SQL Editor
2. Cole o conteúdo de `SQL-CREATE-PROCESS-WITHDRAWAL.sql`
3. Execute (Ctrl+Enter)
4. ✅ Confirme: "Função process_withdrawal criada com sucesso!"

---

### PASSO 2: Usuário Solicita Saque

1. **Entre como vendedor** (usuário que vendeu itens)
2. Vá para **Perfil** → Seção financeira
3. Verifique que tem **Saldo Disponível** > R$ 10,00
4. Clique em **"Solicitar Saque"**
5. Preencha:
   - Valor (mínimo R$ 10,00)
   - Confirme que chave PIX está cadastrada
6. Clique **"SOLICITAR SAQUE"**
7. ✅ Toast: "Solicitação enviada! Processaremos em até 2 dias úteis."

---

### PASSO 3: Admin Visualiza Solicitação

1. **Entre como administrador**
2. Acesse **AdminDashboard** (`/admin/dashboard`)
3. Role até a seção **"Solicitações de Saque"**
4. Veja:
   - Contador de pendentes (amarelo)
   - Tabela com todas as solicitações
   - Status: `PENDENTE` (em amarelo)
   - Botão **"PROCESSAR"**

---

### PASSO 4: Admin Processa Saque

#### ✅ Aprovar Saque:

1. Clique em **"PROCESSAR"** na linha do saque
2. Modal abre com:
   - Nome e e-mail do usuário
   - Valor do saque (dourado)
   - Chave PIX completa
3. **Importante:** Faça o pagamento real via PIX para a chave exibida
4. Adicione observação (opcional):
   ```
   Pago via PIX em 05/03/2026 às 14:30
   ```
5. Clique **"APROVAR SAQUE"**
6. Confirme: "Confirmar liberação de R$ X,XX para [Nome]?"
7. ✅ Toast: "Saque aprovado e processado com sucesso!"
8. Status muda para: `CONCLUIDO` (verde)
9. Movimentação registrada no ledger com tipo `saque_aprovado`

#### ❌ Cancelar Saque:

1. Clique em **"PROCESSAR"**
2. Adicione motivo (opcional):
   ```
   Chave PIX inválida - solicitar atualização
   ```
3. Clique **"CANCELAR SAQUE"**
4. Confirme: "Cancelar saque de R$ X,XX?"
5. ✅ Toast: "Saque cancelado"
6. Status muda para: `CANCELADO` (vermelho)

---

## 📋 VALIDAÇÕES DE SEGURANÇA:

### ✅ Ao Solicitar Saque (Usuário):

- Valor mínimo: R$ 10,00
- Saldo suficiente no momento da solicitação
- Chave PIX cadastrada no perfil
- Status inicial: `pendente`

### ✅ Ao Aprovar Saque (Admin):

- **Revalidação de saldo** (mesmo que tenha passado dias)
- Verifica se saque ainda está pendente
- Registra timestamp de processamento
- Registra no ledger para auditoria
- Ação irreversível

### ✅ RLS (Row Level Security):

- Usuários veem apenas seus próprios saques
- Admins veem todos os saques
- Apenas admins podem processar saques

---

## 🔍 VERIFICAR NO BANCO:

### Ver saques pendentes:
```sql
SELECT 
  w.id,
  w.amount,
  w.status,
  w.requested_at,
  p.full_name,
  p.email
FROM withdrawals w
LEFT JOIN profiles p ON p.id = w.user_id
WHERE w.status = 'pendente'
ORDER BY w.requested_at DESC;
```

### Ver histórico de saques de um usuário:
```sql
SELECT * FROM withdrawals
WHERE user_id = 'UUID_DO_USUARIO'
ORDER BY requested_at DESC;
```

### Ver movimentações de saques no ledger:
```sql
SELECT * FROM financial_ledger
WHERE entry_type = 'saque_aprovado'
ORDER BY created_at DESC;
```

---

## 🎯 FLUXO COMPLETO:

```
👤 VENDEDOR
   ↓
   Vende item → Confirma entrega → Saldo disponível ✅
   ↓
   "Solicitar Saque" → Preenche valor + PIX
   ↓
   Status: PENDENTE (amarelo) 🟡
   ↓
   Aguarda aprovação admin...
   
   
👨‍💼 ADMIN
   ↓
   Vê solicitação no cofre central
   ↓
   Clica "PROCESSAR" → Modal abre
   ↓
   Faz pagamento PIX real 💸
   ↓
   Adiciona nota: "Pago em 05/03/2026"
   ↓
   Clica "APROVAR SAQUE"
   ↓
   Status: CONCLUIDO (verde) 🟢
   ↓
   Registrado no ledger para auditoria 📊


👤 VENDEDOR
   ↓
   Recebe notificação (futura implementação)
   ↓
   Verifica histórico: Status CONCLUIDO ✅
```

---

## 🐛 SOLUÇÃO DE PROBLEMAS:

### Erro: "Função process_withdrawal não existe"
**Solução:** Execute `SQL-CREATE-PROCESS-WITHDRAWAL.sql` no Supabase

### Erro: "Tabela withdrawals não existe"
**Solução:** Execute `SQL-Create-Financial-Dashboard.sql` primeiro

### Erro: RLS bloqueia visualização
**Solução:** Verifique se usuário tem `role = 'admin'` na tabela `profiles`

### Saque não aparece no admin
**Solução:** Verifique se a política RLS "Admins veem todos os saques" foi criada

### Saldo não atualiza após aprovação
**Solução:** Isso é esperado - o saldo já foi contabilizado. O ledger registra a saída.

---

## 📊 RELATÓRIOS ÚTEIS:

### Total de saques por status:
```sql
SELECT 
  status,
  COUNT(*) AS quantidade,
  SUM(amount) AS total
FROM withdrawals
GROUP BY status
ORDER BY status;
```

### Saques processados hoje:
```sql
SELECT * FROM withdrawals
WHERE DATE(processed_at) = CURRENT_DATE
ORDER BY processed_at DESC;
```

### Usuário com mais saques:
```sql
SELECT 
  p.full_name,
  COUNT(*) AS total_saques,
  SUM(w.amount) AS total_valor
FROM withdrawals w
LEFT JOIN profiles p ON p.id = w.user_id
WHERE w.status = 'concluido'
GROUP BY p.full_name
ORDER BY total_valor DESC
LIMIT 10;
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO:

- [x] Tabela `withdrawals` existe
- [x] Função `create_withdrawal()` funcional
- [x] Função `process_withdrawal()` criada
- [x] RLS configurada para user e admin
- [x] Modal de solicitação (usuário)
- [x] Seção de saques no AdminDashboard
- [x] Modal de processamento (admin)
- [x] Registro no financial_ledger
- [x] Validações de segurança
- [ ] Notificações por e-mail (futura)
- [ ] Webhook de confirmação (futura)

---

## 🚀 PRÓXIMOS PASSOS (OPCIONAIS):

1. **Notificações:**
   - Enviar e-mail quando saque for aprovado/cancelado
   - Toast in-app quando status mudar

2. **Automação:**
   - Integração com API de pagamentos PIX
   - Aprovação automática após confirmação PIX

3. **Auditoria:**
   - Log de admin que processou cada saque
   - Histórico de alterações de status

4. **Relatórios:**
   - Dashboard de saques mensal
   - Exportação CSV de saques

---

**Data:** 5 de março de 2026  
**Status:** ✅ Implementado e pronto para testes

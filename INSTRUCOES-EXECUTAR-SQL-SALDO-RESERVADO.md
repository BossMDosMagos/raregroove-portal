# 🚀 EXECUTAR AGORA: SQL-FIX-SALDO-RESERVADO-IMEDIATO.sql

## 📋 O que este SQL faz?

### Problema Resolvido ✅
Antes: Usuário podia solicitar múltiplos saques porque `saldo_disponível` não era decrementado
Depois: `saldo_disponível` é = (vendas-concluidas) - (saques-em-análise)

### Resultado
1. **Botão "Sacar" desaparece automaticamente** quando já há saque em análise
2. **Impossível duplicar saques** porque saldo fica zerado
3. **RPC create_withdrawal() valida** se já existe saque ativo

---

## 🔧 Como Executar?

### Opção 1: Via Supabase Dashboard (RECOMENDADO)

1. **Abrir Supabase**:
   - Ir para: https://supabase.com/dashboard
   - Selecionar projeto "raregroove-prod"

2. **Acessar SQL Editor**:
   - Menu esquerdo → "SQL Editor"
   - Click "New query"

3. **Copiar SQL Completo**:
   - Abrir arquivo: `SQL-FIX-SALDO-RESERVADO-IMEDIATO.sql`
   - Selecionar TODO o conteúdo (Ctrl+A)
   - Copiar (Ctrl+C)

4. **Colar no Supabase**:
   - No editor do Supabase, colar (Ctrl+V)
   - ⚠️ **IMPORTANTE**: Verificar se há `BEGIN;` no início
   - Se estiver tudo correto, click "Run" (botão azul)

5. **Verificar Resultado**:
   - Se sucesso: ✅ "Query Successful"
   - Se erro: ❌ Mostra mensagem de erro (copiar e reporte)

### Opção 2: Via Supabase CLI (Avançado)

```bash
# 1. Instalar CLI (se não tiver):
npm install -g supabase

# 2. Logar:
supabase login

# 3. Listar projetos:
supabase projects list

# 4. Executar SQL:
supabase db execute --file SQL-FIX-SALDO-RESERVADO-IMEDIATO.sql
```

---

## 📊 O que Será Criado/Alterado?

### 1. Função `get_user_financials(user_uuid)`
**Antes**:
```javascript
// Calculava apenas vendas concluídas
saldo_disponível = 1000.00  // Sem descontar saques em análise!
```

**Depois**:
```javascript
// Lê saques EM ANÁLISE e desconta
Vendas concluídas: 1000.00
Saques bloqueados: -500.00
saldo_disponível = 500.00  // ✅ Correto!
```

### 2. Função `create_withdrawal(user_uuid, amount)`
**Validações adicionadas**:
- ✅ Verifica se já existe saque em `'pendente'` ou `'processando'`
- ✅ Se sim, retorna erro: `"Você já possui um saque em análise"`
- ✅ Se não, cria novo saque com status='pendente'
- ✅ Saldo é validado contra a função recalculada

### 3. Índice Único (UNIQUE) na tabela `withdrawals`
```sql
CREATE UNIQUE INDEX idx_withdrawals_active_per_user 
ON withdrawals(user_id) 
WHERE status IN ('pendente', 'processando', 'concluido')
```
Isto FORÇA o banco de dados a rejeitar 2º saque mesmo se código tem bug

### 4. Políticas RLS (Row Level Security)
Se havia restrições antigas, serão conservadas e melhoradas

---

## ✅ Teste Depois de Executar

### 1. Testar Saque Inicial
```
1. Logar como Vendedor
2. Ir para "Minha Conta" → "Financeiro"
3. Verificar seco "Meus Saques"
4. Clicar botão "Sacar" (se saldo >= R$ 10)
5. Modal aparece com saldo total (não editável)
6. Click "Confirmar"
7. Saque criado com status='pendente'
```

**Resultado esperado**:
- ✅ Saque criado com sucesso
- ✅ Saldo fica zerado (reservado)
- ✅ Botão desaparece (hasActiveWithdrawal=true)

### 2. Testar Bloqueio Duplicado
```
1. Com mesmo usuário (com saque em análise)
2. Tentar clicar "Sacar" novamente
3. Botão deve estar DESABILITADO/OCULTO
```

**Resultado esperado**:
- ✅ Botão não aparece ou está cinzento
- ✅ Se conseguir clicar (edge case), API rejeita

### 3. Testar Cancelamento
```
1. Admin abre Supabase SQL Editor
2. Executa:
   UPDATE withdrawals SET status='cancelado' 
   WHERE user_id='[user-uuid]' AND status='pendente'
3. Usuário recarrega página
4. Botão "Sacar" deve reaparecer
5. Saldo deve voltar ao valor original
```

**Resultado esperado**:
- ✅ Saldo restaurado
- ✅ Botão reativado
- ✅ Novo saque pode ser solicitado

---

## 🔍 Validações Incluídas

### No RPC `create_withdrawal()`
```sql
-- 1. Check if user_uuid is provided
IF user_uuid IS NULL THEN
  RAISE EXCEPTION 'user_id não pode ser null'

-- 2. Check if amount is positive
IF amount <= 0 THEN
  RAISE EXCEPTION 'Valor do saque deve ser maior que 0'

-- 3. Check for duplicate ACTIVE withdrawal
IF existing_withdrawal_id IS NOT NULL THEN
  RAISE EXCEPTION 'Você já possui um saque em análise'

-- 4. Check available balance
IF amount > available_balance THEN
  RAISE EXCEPTION 'Saldo insuficiente'
```

### No Frontend `FinancialComponents.jsx`
```javascript
// Já estava ali, mas agora mais preciso:
- Botão só renderiza se: saldo_disponível >= 10
- Botão só clickável se: !hasActiveWithdrawal
- Modal mostra automaticamente amount = saldo_disponível (não editável)
```

---

## ⚠️ Rollback (Se Problema)

Se pela alguma razão o SQL causar erro, pode rollback:

### Opção 1: Reverter Função Anterior
```sql
-- No Supabase SQL Editor, execute:
SELECT pg_drop_function('public.get_user_financials', 'uuid');
SELECT pg_drop_function('public.create_withdrawal', 'uuid, numeric');

-- Depois recriar a versão anterior (peça em suporte)
```

### Opção 2: Usar Backup
- Se tinha backup anterior (recomendado)
- Pede ao Supabase para restaurar a partir de snapshot

---

## 📞 Se der Erro

**Copie EXATAMENTE a mensagem de erro e reporte:**

Exemplo:
```
ERROR:  Column "saldo_reserved" does not exist
DETAIL: Parse error - line 45
```

Informações úteis:
- ✅ Seu ID de usuário (para teste)
- ✅ Nome do projeto Supabase
- ✅ Data/hora da tentativa
- ✅ TODA a mensagem de erro (com detalhes)

---

## 📊 Status Post-Execução

Após sucesso, deverá ver:

```sql
-- Query resultado:
✅ Função get_user_financials RECRIADA
✅ Função create_withdrawal() RECRIADA com validações
✅ Índice único de saques CRIADO
✅ Políticas RLS mantidas/melhoradas
✅ Função trigger de updated_at mantida
```

E na Interface:
1. Saldo mostra valor correto (descontado do saque)
2. Botão saque desaparece quando há análise
3. Impossível criar 2º saque enquanto primeiro em análise

---

## 🎯 Cronograma

| Etapa | Comando | Tempo |
|-------|---------|-------|
| 1. Ir para Supabase | Link | <1 min |
| 2. Copiar SQL | Ctrl+A, Ctrl+C | 1 min |
| 3. Colar e executar | Ctrl+V, Run | 1 min |
| 4. Validar resultado | Refresh UI | 2 min |
| 5. Testar saque | Action | 5 min |
| **TOTAL** | **Concluído** | **~10 min** |

---

**Última atualização**: 2026-03-05
**Versão**: 1.0
**Status**: ✅ Pronto para execução

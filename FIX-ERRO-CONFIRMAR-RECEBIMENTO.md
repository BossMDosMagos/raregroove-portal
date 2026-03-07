# 🚨 FIX: Erro ao Confirmar Recebimento (Comprador)

## ❌ Problema

**Erro no Console:**
```
invalid input syntax for type bigint: "b357cfb8-98ad-4715-bb86-babf48850163"
```

**Quando ocorre:**
- Ao clicar em "Confirmar Recebimento" na página de transações do comprador
- Ao vendedor tentar salvar código de rastreio (similar)

**Fluxo de erro:**
```
1. Comprador clica "Confirmar Recebimento"
   ↓
2. FinancialComponents.jsx chama: supabase.rpc('confirm_delivery', ...)
   ↓
3. Envia: p_transaction_id = 'b357cfb8-98ad-4715-bb86-babf48850163' (UUID string)
   ↓
4. SQL Function espera: BIGINT (número inteiro)
   ↓
5. ❌ PostgreSQL falha: "cannot convert UUID to BIGINT"
```

---

## 🔍 Causa Raiz

**Tabela `transactions` usa UUID:**
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY,              -- ← UUID, não BIGINT
  buyer_id UUID REFERENCES auth.users,
  seller_id UUID REFERENCES auth.users,
  ...
)
```

**Mas as functions foram definidas com BIGINT:**
```sql
-- ❌ ERRADO
CREATE OR REPLACE FUNCTION add_tracking_code(
  p_transaction_id BIGINT,          -- ← Espera número inteiro
  p_tracking_code TEXT
)

CREATE OR REPLACE FUNCTION confirm_delivery(
  p_transaction_id BIGINT           -- ← Espera número inteiro
)
```

**React envia UUID:**
```jsx
const { data, error } = await supabase
  .rpc('confirm_delivery', {
    p_transaction_id: transaction.transaction_id  // UUID string
  });
```

**Resultado:** Type mismatch - PostgreSQL não consegue converter UUID para BIGINT

---

## ✅ Solução

### **Execute no Supabase SQL Editor:**

```sql
-- Dropar versão antiga (com BIGINT)
DROP FUNCTION IF EXISTS add_tracking_code(BIGINT, TEXT);
DROP FUNCTION IF EXISTS confirm_delivery(BIGINT);

-- Recriar com UUID
CREATE OR REPLACE FUNCTION add_tracking_code(
  p_transaction_id UUID,            -- ✅ Mudou de BIGINT
  p_tracking_code TEXT
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$ ... $$;

CREATE OR REPLACE FUNCTION confirm_delivery(
  p_transaction_id UUID             -- ✅ Mudou de BIGINT
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$ ... $$;
```

---

## 📋 Passos para Aplicar

1. **Acesse** [Supabase Console](https://supabase.com/dashboard) → seu projeto
2. **Vá para** "SQL Editor" (menu lateral esquerdo)
3. **Cole TODO o conteúdo** do arquivo `SQL-FIX-CONFIRM-DELIVERY-UUID.sql`
4. **Clique em** "▶ Run" (botão azul)
5. **Aguarde** confirmação: `✅ FIX aplicado com sucesso!`
6. **Teste novamente** confirmar recebimento na aplicação

---

## 🧪 Validação

Após executar o SQL, teste:

1. **Como Comprador:**
   - Acesse "Minhas Compras" (Dashboard)
   - Localize uma transação com status "Enviado"
   - Clique em "Confirmar Recebimento"
   - **Deve confirmar sem erros** e mostrar modal de avaliação

2. **Como Vendedor:**
   - Acesse "Minhas Vendas" 
   - Localize uma transação com status "Aguardando Envio"
   - Clique em "Salvar Código e Marcar como Enviado"
   - **Deve salvar sem erros** e notificar comprador

---

## 📚 Referências

- **Arquivo SQL**: [SQL-FIX-CONFIRM-DELIVERY-UUID.sql](SQL-FIX-CONFIRM-DELIVERY-UUID.sql)
- **Código afetado (React)**: [FinancialComponents.jsx](src/components/FinancialComponents.jsx) linha 193
- **Código afetado (React)**: [ShippingLabelCard.jsx](src/components/ShippingLabelCard.jsx) linha 523
- **PostgreSQL Docs**: [Function Definitions](https://www.postgresql.org/docs/current/sql-createfunction.html)

---

## 🔧 Detalhes Técnicos

### Tabela de Funções Afetadas

| Função | Parâmetro Antigo | Parâmetro Novo | Chamada de |
|--------|---|---|---|
| `add_tracking_code()` | `p_transaction_id BIGINT` | `p_transaction_id UUID` | Vendedor (ao salvar rastreio) |
| `confirm_delivery()` | `p_transaction_id BIGINT` | `p_transaction_id UUID` | Comprador (ao confirmar recebimento) |

### Fluxos de Execução (Antes vs. Depois)

**❌ ANTES (com erro):**
```
1. handleConfirmDelivery() em React
   ↓
2. supabase.rpc('confirm_delivery', { 
      p_transaction_id: 'b357cfb8-...' })
   ↓
3. SQL Function recebe String UUID
   ↓
4. Trata como BIGINT → ERRO de conversão
```

**✅ DEPOIS (funcionando):**
```
1. handleConfirmDelivery() em React
   ↓
2. supabase.rpc('confirm_delivery', { 
      p_transaction_id: 'b357cfb8-...' })
   ↓
3. SQL Function recebe UUID (tipo esperado)
   ↓
4. Executa UPDATE e retorna JSON com sucesso
```

---

## 💡 Prevenção Futura

Sempre definir functions com os tipos de dados **corretos**:

```sql
-- ✅ BOM (matches transactions.id which is UUID)
CREATE OR REPLACE FUNCTION confirm_delivery(
  p_transaction_id UUID
)

-- ❌ RUIM (mismatches with actual column type)
CREATE OR REPLACE FUNCTION confirm_delivery(
  p_transaction_id BIGINT
)
```

**Tip:** Use `\d transactions` no psql para verificar tipos de colunas antes de criar functions.

---

## 📊 Status de Aplicação

- [ ] SQL executado no Supabase
- [ ] Comprador testou "Confirmar Recebimento"
- [ ] Vendedor testou "Salvar Código de Rastreio"
- [ ] Ambos funcionando sem erros

Marque as caixas acima após concluir!

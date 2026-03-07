# 📦 Fluxo de Baixa de Estoque - Venda de Itens

## 🔄 Fluxo Atual (Implementado)

### 1. **Pagamento Aprovado**
- Usuário completa pagamento no Mercado Pago (status: `approved`)
- Retorna à tela `/payment/success` com parâmetros: `payment_id`, `status`, `total_amount`, etc.

### 2. **Edge Function: process-transaction**
Arquivo: `supabase/functions/process-transaction/index.ts`

**Etapas:**
1. ✅ Cria registro de **transação** na tabela `transactions`
2. ✅ Marca o **item como vendido** na tabela `items`:
   ```sql
   UPDATE items 
   SET is_sold = true, 
       sold_to_id = buyerId, 
       sold_date = NOW()
   WHERE id = itemId
   ```
3. ✅ Registra informações de **shipping** (opcional)
4. ✅ Atualiza **ledger financeiro**:
   - Portal sale: `entry_type = 'receita_portal'` (100%)
   - Marketplace: `entry_type = 'venda_realizada'` (vendedor) + `taxa_plataforma` (portal)

### 3. **Tela de Sucesso Atualizada**
Arquivo: `src/pages/PaymentSuccess.jsx`

**Novidades:**
- ✅ Alerta visual: "Item marcado como vendido"
- ✅ Badge "✓ VENDIDO" sobre imagem do item
- ✅ Status verde confirmando indisponibilidade para outros

---

## 🔌 Webhook do Mercado Pago (Teste)

### Por que precisamos?
O webhook monitora **mudanças de status** em **tempo real**:
- `approved` → venda confirmada
- `pending` → aguardando confirmação
- `rejected` → venda cancelada

### Como Configurar no Mercado Pago

#### Opção 1: Dashboard Manual
1. Acesse https://www.mercadopago.com.br/settings/account/notifications
2. Vá em **Webhooks**
3. Clique em **Novo Webhook**
4. **URL:** `https://seu-dominio.com/api/webhooks/mercado-pago`
5. **Eventos** a monitorar:
   - `payment.created`
   - `payment.updated`
6. Clique em **Testar Webhook** para validar

#### Opção 2: API (Automático)
```bash
curl -X POST https://api.mercadopago.com/v1/notifications/webhooks \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://seu-dominio.com/api/webhooks/mercado-pago",
    "events": ["payment.created", "payment.updated"]
  }'
```

---

## 🧪 Teste em Ambiente Local (Sandbox)

Como localhost não pode receber webhooks reais, o sistema foi configurado para:

### ✅ Fluxo Manual (Implementado)
1. Clique em "Efetuar Pagamento"
2. Pague no Mercado Pago (abrir em nova aba)
3. Após pagar, clique em **"Já paguei, voltar ao portal"**
4. Sistema:
   - Cria transação automaticamente
   - Marca item como vendido
   - Mostra tela de sucesso com status

### 📝 Dados de Teste Sandbox

**Buyer (Comprador):**
- ID de teste (salvo no admin): Ver em `/admin/fees` → "Credenciais de Teste"

**Cartão de Teste:**
- Número: `4111 1111 1111 1111`
- Validade: `12/25`
- CVC: `123`

---

## 📊 Verificar Status da Venda

### No Banco de Dados

```sql
-- Ver item marcado como vendido
SELECT id, title, is_sold, sold_to_id, sold_date
FROM items
WHERE id = 'uuid-do-item'
  AND is_sold = true;

-- Ver transação criada
SELECT id, buyer_id, item_id, status, total_amount
FROM transactions
WHERE item_id = 'uuid-do-item'
ORDER BY created_at DESC;

-- Ver receitas registradas
SELECT entry_type, amount, created_at
FROM financial_ledger
WHERE source_id IN (
  SELECT id FROM transactions WHERE item_id = 'uuid-do-item'
)
ORDER BY created_at DESC;
```

### No Admin Dashboard
- Acesse `/admin`
- Verifique card "Receita Total"
- Confira split entre "Portal" e "Taxa Marketplace"

---

## 🔍 Troubleshooting

### Item não marca como vendido?

**1. Verificar logs da Edge Function:**
```bash
supabase functions logs process-transaction
```

**Procure por:**
- `✅ Item marcado como vendido com sucesso` → OK
- `❌ Erro ao marcar item como vendido` → Erro detectado
- `[process-transaction] Iniciando processamento` → Função foi chamada

**2. Verificar colunas da tabela items:**
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'items'
ORDER BY ordinal_position;
```
Procure por: `is_sold`, `sold_to_id`, `sold_date`

**3. Verificar permiões RLS:**
```sql
-- Verificar políticas da tabela items
SELECT *
FROM pg_policies
WHERE tablename = 'items';
```

---

## 🚀 Próximos Passos (Opcional)

### 1. **Dashboard de Vendas**
Criar página `/admin/vendas` mostrando:
- Itens vendidos (com filtro de data)
- Vendedores top
- Receita por tipo (portal vs marketplace)

### 2. **Notificação ao Vendedor**
Enviar email/SMS quando item é vendido:
```sql
INSERT INTO notifications (user_id, type, message)
VALUES ('seller-uuid', 'item_sold', 'Seu item foi vendido!');
```

### 3. **Webhook Real (Produção)**
Configurar Edge Function para receber eventos do MP em tempo real:
```typescript
// supabase/functions/webhook-mercado-pago/index.ts
POST /webhook-mercado-pago
  → Valida assinatura do MP
  → Atualiza status da transação
  → Notifica usuários
```

---

## 📞 Suporte

Se o item não for marcado como vendido:
1. Verifique logs da função: `npx supabase functions logs process-transaction`
2. Confirme que paymentSuccess foi chamado com `status=approved`
3. Valide que os campos da tabela `items` existem com esses nomes exatos:
   - `is_sold` (boolean)
   - `sold_to_id` (uuid)
   - `sold_date` (timestamp)

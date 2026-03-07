# 🎯 Implementação: Separação de Receitas Portal vs Marketplace

## 📋 O que foi Implementado

### 1. **Lógica de Separação de Receitas** (Edge Function)

**Arquivo**: `supabase/functions/process-transaction/index.ts`

#### **Vendas do Portal (100% para o portal)**
- Quando `seller_id` é `null` ou `'portal'`
- `transaction_type`: `'venda_portal'`
- `net_amount`: 0 (vendedor não recebe nada)
- Registra na ledger como `'receita_portal'`
- **100% do valor** vai para o cofre do portal

#### **Vendas Marketplace (usuário para usuário)**
- Quando `seller_id` é um UUID de usuário real
- `transaction_type`: `'venda'`
- `net_amount`: preço - taxa de plataforma
- Registra **duas entradas** na ledger:
  - `'venda_realizada'` → vendedor recebe net_amount
  - `'taxa_plataforma'` → portal recebe apenas a taxa de intermediação

### 2. **Dashboard Admin Atualizado**

**Arquivo**: `src/pages/AdminDashboard.jsx`

Novo card de **Receita Total** que mostra:
- **Receita Total**: Soma de vendas portal + taxas marketplace
- **Portal** (verde): Vendas diretas do portal (100%)
- **Taxa Marketplace** (azul): Taxas de intermediação

### 3. **Feedback Visual Melhorado**

**Arquivo**: `src/pages/PaymentSuccess.jsx`

Agora suporta 3 estados visuais:
- ✅ **Success** (verde): Pagamento aprovado
- ⚠️ **Pending** (amarelo): Aguardando confirmação
- ❌ **Failure** (vermelho): Pagamento recusado

### 4. **Retorno Automático do Mercado Pago**

**Arquivos**:
- `supabase/functions/mp-create-preference/index.ts`
- `src/components/PaymentGateway.jsx`
- `src/App.jsx`

Implementado:
- `auto_return: 'approved'` na preferência
- Parâmetros de contexto nas back_urls
- Rotas `/payment/failure` e `/payment/pending`
- Processamento automático de transação no retorno

---

## 🚀 Como Testar

### Passo 1: Deploy das Edge Functions

Execute no terminal (PowerShell):

```powershell
cd c:\PROJETO-RAREGROOVE-3.0
.\DEPLOY-EDGE-FUNCTIONS.bat
```

Ou manualmente:

```powershell
supabase functions deploy mp-create-preference
supabase functions deploy process-transaction
```

### Passo 2: Testar Venda Marketplace (Usuário → Usuário)

1. Crie um item como **usuário normal** (não admin)
2. Faça login com **outro usuário**
3. Compre o item via Mercado Pago sandbox
4. Após pagamento aprovado:
   - ✅ Transação registrada com `transaction_type = 'venda'`
   - ✅ Vendedor recebe `net_amount` em pending_balance
   - ✅ Portal recebe apenas `platform_fee`
   - ✅ Dashboard mostra na **Taxa Marketplace**

### Passo 3: Testar Venda Portal (Portal → Usuário)

1. No banco de dados, crie um item com `seller_id = NULL`
2. Ou edite um item existente: `UPDATE items SET seller_id = NULL WHERE id = '...'`
3. Faça login e compre esse item
4. Após pagamento aprovado:
   - ✅ Transação registrada com `transaction_type = 'venda_portal'`
   - ✅ Portal recebe 100% do valor
   - ✅ Dashboard mostra na **Receita Portal**

### Passo 4: Validar Dashboard Admin

1. Acesse `/admin`
2. Verifique o card **Receita Total**:
   - Deve mostrar separadamente:
     - Receita Portal (verde)
     - Taxa Marketplace (azul)
     - Total combinado

---

## 📊 Consultas SQL para Validar

### Ver todas as transações e tipos

```sql
SELECT 
  id,
  transaction_type,
  seller_id,
  total_amount,
  platform_fee,
  net_amount,
  status
FROM transactions
ORDER BY created_at DESC;
```

### Ver receitas na ledger

```sql
SELECT 
  entry_type,
  amount,
  user_id,
  created_at,
  metadata
FROM financial_ledger
WHERE entry_type IN ('receita_portal', 'taxa_plataforma')
ORDER BY created_at DESC;
```

### Soma de receitas por tipo

```sql
SELECT 
  entry_type,
  SUM(amount) as total_receita
FROM financial_ledger
WHERE entry_type IN ('receita_portal', 'taxa_plataforma')
GROUP BY entry_type;
```

---

## 🔧 Configuração Adicional

### Como marcar itens como "Vendas do Portal"

**Opção 1**: Criar com `seller_id = NULL`

```sql
INSERT INTO items (title, artist, price, seller_id, ...)
VALUES ('Vinil Raro', 'Pink Floyd', 150.00, NULL, ...);
```

**Opção 2**: Atualizar items existentes

```sql
UPDATE items 
SET seller_id = NULL 
WHERE id = 'uuid-do-item';
```

### Criar Usuário "Portal" (Opcional)

Se quiser ter um UUID específico para vendas do portal:

```sql
-- Criar perfil "portal"
INSERT INTO profiles (id, full_name, email)
VALUES ('00000000-0000-0000-0000-000000000001', 'Portal Rare Groove', 'portal@raregroove.com');

-- Marcar items como vendas do portal
UPDATE items 
SET seller_id = '00000000-0000-0000-0000-000000000001'
WHERE ...;
```

---

## ⚠️ Importante

1. **Deploy obrigatório**: As mudanças nas Edge Functions só funcionam após deploy
2. **Dados de teste**: Use as credenciais de teste salvas no admin (`/admin/fees`)
3. **Modo Sandbox**: Certifique-se que `gateway_mode = 'sandbox'`
4. **Transações antigas**: Não serão reclassificadas automaticamente

---

## 🐛 Troubleshooting

### Erro: "Transação não criada"
- Verifique se fez deploy da `process-transaction`
- Confira logs: `supabase functions logs process-transaction`

### Dashboard não mostra separação
- Verifique se há transações com `entry_type = 'receita_portal'`
- Rode a query SQL de validação acima

### Retorno do MP não funciona
- Verifique se fez deploy da `mp-create-preference`
- Confirme que `auto_return: 'approved'` está na preferência

---

## 📝 Próximos Passos Sugeridos

- [ ] Criar interface para admin cadastrar itens do portal
- [ ] Adicionar relatório de receitas por período
- [ ] Implementar gráficos de vendas portal vs marketplace
- [ ] Criar webhook do Mercado Pago para atualização automática
- [ ] Adicionar exportação de relatórios financeiros em CSV/PDF

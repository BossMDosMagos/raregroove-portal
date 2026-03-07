# 🚨 FIX: Erro ao Salvar Código de Rastreio

## ❌ Problema

**Erro no Console:**
```
{
  code: '55000',
  message: 'cannot refresh materialized view "public.user_receivables" concurrently',
  hint: 'Create a unique index with no WHERE clause on one or more columns of the materialized view.'
}
```

**Quando ocorre:**
- Ao clicar em "Salvar Código e Marcar como Enviado" na etiqueta de envio
- Ao atualizar qualquer campo rastreável em `transactions` (tracking_code, shipped_at, delivered_at, status)

---

## 🔍 Causa Raiz

1. **Trigger automático** em `transactions`:
   ```sql
   CREATE TRIGGER trigger_refresh_views_on_tracking
   AFTER UPDATE OF tracking_code, shipped_at, delivered_at, status ON transactions
   FOR EACH STATEMENT
   EXECUTE FUNCTION refresh_financial_views();
   ```

2. **Função tenta fazer refresh concorrente**:
   ```sql
   CREATE OR REPLACE FUNCTION refresh_financial_views()
   RETURNS TRIGGER AS $$
   BEGIN
     REFRESH MATERIALIZED VIEW CONCURRENTLY user_receivables;
     REFRESH MATERIALIZED VIEW CONCURRENTLY user_purchases;
     RETURN NULL;
   END;
   ```

3. **PostgreSQL exige índice único** para `REFRESH MATERIALIZED VIEW CONCURRENTLY`, mas as views só têm índices normais:
   ```sql
   CREATE INDEX idx_user_receivables_user ON user_receivables(user_id);
   CREATE INDEX idx_user_receivables_status ON user_receivables(status);
   -- ❌ FALTA: CREATE UNIQUE INDEX ...
   ```

---

## ✅ Solução

### **Execute no Supabase SQL Editor:**

```sql
-- 1️⃣ Criar índice único em user_receivables
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_receivables_transaction_id_unique 
ON user_receivables(transaction_id);

-- 2️⃣ Criar índice único em user_purchases
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_purchases_transaction_id_unique 
ON user_purchases(transaction_id);

-- 3️⃣ Verificar se funcionou
REFRESH MATERIALIZED VIEW CONCURRENTLY user_receivables;
REFRESH MATERIALIZED VIEW CONCURRENTLY user_purchases;

SELECT '✅ FIX aplicado com sucesso!' AS status;
```

---

## 📋 Passos para Aplicar

1. **Acesse** [Supabase Console](https://supabase.com/dashboard) → seu projeto
2. **Vá para** "SQL Editor" (menu lateral esquerdo)
3. **Cole o SQL** do arquivo `SQL-FIX-USER-RECEIVABLES-UNIQUE-INDEX.sql`
4. **Clique em** "▶ Run" (botão azul)
5. **Aguarde** confirmação de sucesso
6. **Teste novamente** salvar código de rastreio na aplicação

---

## 🧪 Validação

Após executar o SQL, teste:

1. Acesse uma etiqueta de envio pendente
2. Digite um código de rastreio (ex: `AA123456789BR`)
3. Clique em "Salvar Código e Marcar como Enviado"
4. **Deve salvar sem erros** e mostrar:
   ```
   ✓ Código salvo! Status atualizado para "Enviado"
   ```

---

## 📚 Referências

- **Arquivo SQL**: [SQL-FIX-USER-RECEIVABLES-UNIQUE-INDEX.sql](SQL-FIX-USER-RECEIVABLES-UNIQUE-INDEX.sql)
- **PostgreSQL Docs**: [REFRESH MATERIALIZED VIEW](https://www.postgresql.org/docs/current/sql-refreshmaterializedview.html)
- **Código afetado**: [ShippingLabelCard.jsx](src/components/ShippingLabelCard.jsx) linha 504-545 (handleSaveTrackingCode)

---

## 🔧 Detalhes Técnicos

**Fluxo de execução:**

```
1. User clica em "Salvar Código e Marcar como Enviado"
   ↓
2. handleSaveTrackingCode() executa:
   - UPDATE shipping SET tracking_code='...', status='in_transit'
   - UPDATE transactions SET status='enviado' WHERE id='...'
   ↓
3. Trigger "trigger_refresh_views_on_tracking" é disparado
   ↓
4. Função refresh_financial_views() tenta:
   - REFRESH MATERIALIZED VIEW CONCURRENTLY user_receivables
   ↓
5. ❌ FALHA: "cannot refresh concurrently"
   Motivo: Falta UNIQUE INDEX
   ↓
6. ✅ SOLUÇÃO: CREATE UNIQUE INDEX ... ON user_receivables(transaction_id)
```

**Por que transaction_id?**
- É a chave primária da transação (valor único garantido)
- Está presente em todas as linhas da materialized view
- É a coluna mais eficiente para identificar registros únicos

---

## 💡 Prevenção Futura

Sempre que criar **materialized views** que serão atualizadas com `CONCURRENTLY`, adicionar:

```sql
-- ✅ BOM
CREATE MATERIALIZED VIEW minha_view AS SELECT ...;
CREATE UNIQUE INDEX idx_minha_view_unique_key ON minha_view(coluna_unica);

-- ❌ RUIM (vai falhar no refresh concorrente)
CREATE MATERIALIZED VIEW minha_view AS SELECT ...;
CREATE INDEX idx_minha_view_normal ON minha_view(coluna);
```

# 🛡️ SEGURANÇA - QUICK REFERENCE

## 🚀 CHECKLIST RÁPIDO

### Antes de Deploy
- [ ] Executar `SQL-CREATE-WEBHOOK-LOGS.sql` no Supabase
- [ ] Configurar `STRIPE_WEBHOOK_SECRET` no Supabase Secrets
- [ ] Deploy Edge Functions atualizadas
- [ ] Testar honey pot em signup e swap
- [ ] Validar webhook signature com Stripe CLI
- [ ] Verificar rate limiting funcionando

---

## 📁 ARQUIVOS CRIADOS/MODIFICADOS

| Arquivo | Descrição |
|---------|-----------|
| [src/pages/Auth/Login.jsx](src/pages/Auth/Login.jsx) | ✅ Honey pot no signup |
| [src/components/SwapProposalModal.jsx](src/components/SwapProposalModal.jsx) | ✅ Honey pot na proposta troca |
| [supabase/functions/_shared/security.ts](supabase/functions/_shared/security.ts) | ✅ Utilities de segurança |
| [supabase/functions/stripe-create-payment-intent/index.ts](supabase/functions/stripe-create-payment-intent/index.ts) | ✅ Validação completa |
| [supabase/functions/stripe-webhook/index.ts](supabase/functions/stripe-webhook/index.ts) | ✅ Webhook securizado |
| [SQL-CREATE-WEBHOOK-LOGS.sql](SQL-CREATE-WEBHOOK-LOGS.sql) | ✅ Tabela de logs |
| [SEGURANCA-BLINDAGEM-COMPLETA.md](SEGURANCA-BLINDAGEM-COMPLETA.md) | 📖 Documentação |

---

## 🔧 COMANDOS ESSENCIAIS

### Deploy Edge Functions
```bash
# Deploy todas
supabase functions deploy stripe-create-payment-intent
supabase functions deploy stripe-webhook

# Configurar secrets
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxx
supabase secrets set STRIPE_SECRET_KEY=sk_xxxxx
```

### Testar Webhooks Localmente
```bash
# Escutar webhooks
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook

# Enviar teste
stripe trigger payment_intent.succeeded
```

### Executar SQL
```sql
-- No Supabase SQL Editor:
-- 1. Copiar conteúdo de SQL-CREATE-WEBHOOK-LOGS.sql
-- 2. Executar
-- 3. Verificar: SELECT * FROM webhook_logs LIMIT 1;
```

---

## 🍯 HONEY POT - Como Funciona

```
[Bot preenche campo oculto]
     ↓
[Frontend detecta]
     ↓
[Bloqueia requisição]
     ↓
[Log: "🚨 BOT DETECTADO"]
     ↓
[Usuário vê: "ACESSO NEGADO"]
```

**Campos monitrados**:
- `address_secondary_field` (signup)
- `website_url` (swap proposal)

---

## ⏱️ RATE LIMITING - Limites

| Rota | Limite | Janela |
|------|--------|--------|
| Stripe Payment Intent | 10 req | 60s |
| Signup (frontend) | 1 req | 60s |

**Resposta quando excedido**:
```json
{
  "error": "Muitas tentativas",
  "retryAfter": 45
}
```

---

## 💰 VALIDAÇÃO DE VALORES

### ❌ NUNCA FAZER:
```typescript
// Frontend envia valor
const { amount } = req.json();
stripe.paymentIntents.create({ amount }); // PERIGOSO!
```

### ✅ SEMPRE FAZER:
```typescript
// Frontend envia apenas ID
const { transaction_id } = req.json();

// Backend busca do banco
const tx = await supabase
  .from('transactions')
  .select('price, fees')
  .eq('id', transaction_id)
  .single();

// Backend calcula
const amount = (tx.price + tx.fees) * 100;

// Backend valida
if (amount <= 0) throw new Error('Inválido');

// Criar pagamento
stripe.paymentIntents.create({ amount });
```

---

## 🔐 WEBHOOK SIGNATURE

### Configurar no Stripe

1. Dashboard → Developers → Webhooks
2. Add endpoint: `https://PROJECT.supabase.co/functions/v1/stripe-webhook`
3. Selecionar eventos:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
4. Copiar **Signing secret** (`whsec_...`)
5. Adicionar no Supabase: `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...`

### Validação Automática

```typescript
// Edge Function valida automaticamente:
const event = stripe.webhooks.constructEvent(
  payload,
  signature,
  webhookSecret
);

// Se assinatura inválida → HTTP 400
// Se assinatura válida → Processa evento
```

---

## 🛡️ SECURITY HEADERS

Todas as respostas incluem:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'
```

---

## 🧪 TESTES RÁPIDOS

### 1. Honey Pot
```bash
# Signup com campo honey pot preenchido (deve falhar)
curl -X POST http://localhost:5173/auth/signup \
  -d "address_secondary_field=bot"

# Resultado: ❌ ACESSO NEGADO
```

### 2. Rate Limiting
```bash
# 15 requisições rápidas (deve bloquear após 10)
for i in {1..15}; do
  curl http://localhost:54321/functions/v1/stripe-create-payment-intent &
done

# Resultado: HTTP 429 após 10ª requisição
```

### 3. Validação Valores
```bash
# Tentar criar pagamento sem transaction_id (deve falhar)
curl -X POST http://localhost:54321/functions/v1/stripe-create-payment-intent \
  -H "Authorization: Bearer TOKEN" \
  -d '{"amount": 999999}'

# Resultado: ❌ "transaction_id ou swap_id é obrigatório"
```

### 4. Webhook Invalid Signature
```bash
# Webhook sem assinatura (deve falhar)
curl -X POST http://localhost:54321/functions/v1/stripe-webhook \
  -d '{"fake":"webhook"}'

# Resultado: ❌ HTTP 401 "Assinatura inválida"
```

---

## 📊 MONITORAMENTO

### Logs Importantes

**Ataques detectados** (buscar no console):
```
🚨 BOT DETECTADO
🚨 Rate limit excedido para IP
❌ Assinatura do webhook ausente
❌ Falha na validação da assinatura
```

**Operações normais**:
```
✅ Assinatura do webhook validada
✅ Transação atualizada para PAGO
💰 Pagamento confirmado
```

### Queries Úteis

```sql
-- Ver últimos webhooks
SELECT * FROM webhook_logs 
ORDER BY created_at DESC 
LIMIT 10;

-- Webhooks por tipo (últimas 24h)
SELECT event_type, COUNT(*) 
FROM webhook_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type;

-- Detecções de bot (se implementar log)
SELECT COUNT(*) as bot_attempts
FROM security_logs
WHERE event_type = 'honey_pot_triggered'
AND created_at > NOW() - INTERVAL '7 days';
```

---

## 🚨 TROUBLESHOOTING RÁPIDO

| Problema | Causa Provável | Solução |
|----------|----------------|---------|
| Honey pot bloqueando usuário legítimo | Autocomplete preencheu campo | Verificar `autoComplete="off"` no input |
| Rate limit muito agressivo | Limite baixo | Ajustar `maxRequests` em security.ts |
| Webhook signature inválida | Secret incorreto | Verificar `STRIPE_WEBHOOK_SECRET` |
| Valor inválido | Transaction não encontrada | Verificar `transaction_id` existe |
| CORS error | Headers faltando | Verificar `getSecurityHeaders()` |

---

## 📞 SUPORTE

**Documentação Completa**: [SEGURANCA-BLINDAGEM-COMPLETA.md](SEGURANCA-BLINDAGEM-COMPLETA.md)

**Logs de Deploy**: 
```bash
supabase functions logs stripe-create-payment-intent
supabase functions logs stripe-webhook
```

**Testar no Stripe**:
- Dashboard → Developers → Webhooks → Send test webhook
- CLI: `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook`

---

**Última atualização**: 5 de Março de 2026  
**Status**: ✅ PRODUÇÃO-READY

# 🔧 Configuração de Gateway de Pagamentos

O sistema Rare Groove suporta 3 gateways de pagamento:
- ✅ **Stripe** (Recomendado para Brasil)
- ✅ **Mercado Pago** (Nativo do Brasil)
- ✅ **PayPal** (Internacional)

---

## 1️⃣ ACESSAR SUPABASE PARA CONFIGURAR AS CHAVES

1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá para: **Database** → **Tables**
4. Procure a tabela: **`platform_settings`**
5. Clique em editar o registro com `id = 1`

---

## 2️⃣ CONFIGURAÇÃO DO STRIPE (RECOMENDADO)

### Obter Chaves Stripe:
1. Acesse: https://dashboard.stripe.com/apikeys
2. Você verá:
   - **Publishable key** (Começar com `pk_`)
   - **Secret key** (Começar com `sk_`)
3. Para SANDBOX, usar as chaves começadas com `pk_test_` e `sk_test_`
4. Para PRODUCTION, usar `pk_live_` e `sk_live_`

### Preencher no Supabase (Campo `platform_settings`):

| Campo | Valor |
|-------|-------|
| `gateway_provider` | `stripe` |
| `gateway_mode` | `sandbox` (para testes) ou `production` |
| `stripe_publishable_key_sandbox` | `pk_test_...` (da Stripe) |
| `stripe_secret_key_sandbox` | `sk_test_...` (da Stripe) |
| `stripe_webhook_secret_sandbox` | `whsec_...` (ver Webhooks abaixo) |

### Configurar Webhooks no Stripe:
1. No Stripe Dashboard: **Developers** → **Webhooks**
2. Clique em "Add Endpoint"
3. URL: `https://seu-dominio.supabase.co/functions/v1/stripe-webhook`
4. Eventos para ouvir:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copie o "Signing secret" (começa com `whsec_`)
6. Cole em `stripe_webhook_secret_sandbox`

---

## 3️⃣ CONFIGURAÇÃO DO MERCADO PAGO

### Obter Chaves Mercado Pago:
1. Acesse: https://www.mercadopago.com.br/developers/pt-BR/reference
2. Faça login com sua conta
3. Vá para: **Credenciais** → **Seu negócio**
4. Você verá:
   - **Public Key** (Começa com `APP_USR_...`)
   - **Access Token** (Token de acesso)

### Preencher no Supabase:

| Campo | Valor |
|-------|-------|
| `gateway_provider` | `mercado_pago` |
| `gateway_mode` | `sandbox` ou `production` |
| `mp_public_key_sandbox` | `APP_USR_...` (do Mercado Pago) |
| `mp_access_token_sandbox` | Token do Mercado Pago |

---

## 4️⃣ CONFIGURAÇÃO DO PAYPAL

### Obter Chaves PayPal:
1. Acesse: https://developer.paypal.com/dashboard
2. Faça login/crie conta
3. Vá para: **Apps & Credentials**
4. Selecione ambiente **Sandbox** ou **Live**
5. Clique em **Create App** (ou use a app existente)
6. Copie:
   - **Client ID**
   - **Secret** 

### Preencher no Supabase:

| Campo | Valor |
|-------|-------|
| `gateway_provider` | `paypal` |
| `gateway_mode` | `sandbox` ou `production` |
| `paypal_client_id_sandbox` | Client ID do PayPal |
| `paypal_client_secret_sandbox` | Secret do PayPal |

---

## 5️⃣ TAXAS E CONFIGURAÇÕES GERAIS

Configure também os campos de taxa:

| Campo | Valor | Descrição |
|-------|-------|-----------|
| `sale_fee_pct` | `10` | Porcentagem de taxa de plataforma (10%) |
| `processing_fee_fixed` | `2.0` | Taxa fixa em R$ por transação |
| `insurance_percentage` | `5` | Seguro como % do valor do item |
| `swap_guarantee_fee_fixed` | `5.0` | Taxa de garantia para swaps |

---

## 6️⃣ DEPLOY DAS EDGE FUNCTIONS

As Edge Functions do Supabase precisam ser deployadas:

```bash
# Navegar para pasta do projeto
cd C:\PROJETO-RAREGROOVE-3.0

# Deploy Stripe
supabase functions deploy stripe-create-payment-intent --no-verify

# Deploy Mercado Pago
supabase functions deploy mp-create-preference --no-verify

# Deploy PayPal
supabase functions deploy paypal-create-order --no-verify
supabase functions deploy paypal-capture-order --no-verify

# Deploy Transaction Processor
supabase functions deploy process-transaction --no-verify
```

---

## 7️⃣ TESTE DE PAGAMENTO

### Stripe Testmode:
Use estes cartões para testar:
- **Sucesso**: `4242 4242 4242 4242`
- **Recusa**: `4000 0000 0000 0002`
- Data: Qualquer futura (ex: `12/25`)
- CVC: Qualquer 3 dígitos

### Mercado Pago Testmode:
- Veja em: https://www.mercadopago.com.br/developers/pt-BR/docs/checkout-pro/test-cards

### PayPal Testmode:
- Crie comprador/vendedor teste em: https://developer.paypal.com/dashboard/accounts

---

## 8️⃣ VERIFICAÇÃO FINAL

Após configurar, teste:

1. **Aplicação**:
   - Clique em **Comprar** em um item
   - Preencha CEP
   - Clique em **Continuar para Pagamento**
   - Deve aparecer o formulário do gateway escolhido

2. **Console do Stripe/MP/PayPal**:
   - Veja se transações aparecem como "Succeeded" ou "Failed"

3. **Supabase**:
   - Tabela `transactions` deve ter registros de teste

---

## 9️⃣ TROUBLESHOOTING

### "Gateway de pagamento não configurado"
- [ ] Verificar se `gateway_provider` está preenchido em `platform_settings`
- [ ] Verificar se `gateway_mode` é `sandbox` ou `production`
- [ ] Verificar se as chaves foram preenchidas corretamente (sem espaços)

### "Payment Intent failed"
- [ ] Verificar `stripe_secret_key_sandbox` está correto
- [ ] Testar com cartão `4242 4242 4242 4242`
- [ ] Ver logs em Stripe Dashboard

### Webhook não funciona
- [ ] Verificar URL do webhook está exata
- [ ] Verificar `stripe_webhook_secret_sandbox` está igual no Stripe
- [ ] Ver logs de erro em Supabase Functions

---

## 🔐 SEGURANÇA

⚠️ **NUNCA** compartilhe:
- Secret Keys (começadas com `sk_`, `sk_live_`)
- Client Secrets do PayPal
- Webhook Secrets

💡 **Boas práticas**:
- Use **Sandbox** para desenvolvimento
- Use **Production** apenas em produção real
- Rotacione chaves periodicamente
- Revise logs de transações regularmente

---

## 📞 SUPORTE

Se tiver problemas:
1. Verificar console do navegador (F12 → Console)
2. Verificar logs Supabase (Functions → Logs)
3. Verificar status do gateway (Stripe/MP/PayPal Dashboard)

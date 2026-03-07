# 🚀 GUIA COMPLETO: ATIVAR PAGAMENTOS EM PRODUÇÃO

## ✅ PRÉ-REQUISITOS

Você já tem:
- ✅ Chaves de STRIPE em produção
- ✅ Chaves de MERCADO PAGO em produção  
- ✅ Chaves de PAYPAL em produção
- ✅ Tudo salvo em CONFIGURAÇÕES FINANCEIRAS / GESTÃO DE GATEWAY

## 📋 PASSO 1: PREPARAR AS CHAVES NO SUPABASE

1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá para: **Database** → **Tables** → **platform_settings**
4. Clique no registro com `id = 1` para editar
5. Preencha APENAS os campos de **PRODUCTION** (não sandbox):
   - `stripe_publishable_key_production`
   - `stripe_secret_key_production`
   - `stripe_webhook_secret_production`
   - `mp_public_key_production`
   - `mp_access_token_production`
   - `paypal_client_id_production`
   - `paypal_client_secret_production`

6. Salve clicando em "Save"

⚠️ **IMPORTANTE**: Copie as chaves **SEM espaços** antes/depois!

---

## 🔧 PASSO 2: EXECUTAR SQL PARA ATIVAR PRODUÇÃO

1. No Supabase, vá para: **SQL Editor**
2. Crie uma nova query
3. Cole o arquivo: **SQL-ATIVAR-PAGAMENTOS-PRODUCAO.sql**
4. Execute o PASSO correspondente ao seu gateway escolhido:
   - **STRIPE**: Execute o PASSO 2
   - **MERCADO PAGO**: Execute o PASSO 3
   - **PAYPAL**: Execute o PASSO 4

Exemplo para **STRIPE**:
```sql
UPDATE platform_settings
SET 
  gateway_provider = 'stripe',
  gateway_mode = 'production',
  sale_fee_pct = 10,
  processing_fee_fixed = 2.0,
  insurance_percentage = 5,
  swap_guarantee_fee_fixed = 5.0,
  default_shipping_from_cep = '01311100'
WHERE id = 1;
```

5. Execute com **Ctrl+Enter** ou botão "Run"
6. Verifique se a atualização foi bem-sucedida

---

## 🌐 PASSO 3: DEPLOY DAS EDGE FUNCTIONS

As Edge Functions precisam estar deployadas no Supabase. Execute os comandos abaixo no terminal:

```bash
# Navegue para o seu projeto
cd C:\PROJETO-RAREGROOVE-3.0

# Deploy das funções necessárias
supabase functions deploy stripe-create-payment-intent --no-verify
supabase functions deploy stripe-webhook --no-verify
supabase functions deploy mp-create-preference --no-verify
supabase functions deploy paypal-create-order --no-verify
supabase functions deploy paypal-capture-order --no-verify
supabase functions deploy process-transaction --no-verify
```

**Resultado esperado**:
```
✓ Function 'stripe-create-payment-intent' deployed
✓ Function 'stripe-webhook' deployed
✓ Function 'mp-create-preference' deployed
✓ Function 'paypal-create-order' deployed
✓ Function 'paypal-capture-order' deployed
✓ Function 'process-transaction' deployed
```

---

## 🔗 PASSO 4: CONFIGURAR WEBHOOKS (STRIPE)

Se escolheu **Stripe**, configure o webhook:

1. Acesse: https://dashboard.stripe.com/webhooks (Produção)
2. Clique em "+ Add Endpoint"
3. Cole a URL:
```
https://[seu-id-projeto].supabase.co/functions/v1/stripe-webhook
```
4. Selecione eventos:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`

5. Clique em "Add endpoint"
6. Copie o "Signing secret" (começa com `whsec_`)
7. Volte ao Supabase
8. Atualize `stripe_webhook_secret_production` com este valor
9. Pronto! ✅

---

## 🧪 PASSO 5: TESTAR COM ANÚNCIO REAL

### Para STRIPE:
1. Crie um novo anúncio com:
   - Preço: **R$ 1,00** (irrisório para teste)
   - Foto: qualquer CD
   - Título: "TESTE CD - R$1.00"

2. Clique em "Comprar"
3. Preencha CEP (use um válido)
4. Selecione opção de frete
5. Clique "Continuar para Pagamento"
6. No formulário Stripe, use:
   - **Cartão**: `4242 4242 4242 4242`
   - **Data**: `12/25` (qualquer futura)
   - **CVC**: `123`
   - **Nome**: `RAUL SEIXAS`
   - **Email**: seu email

7. Clique "Pagar"

**Resultado esperado**:
- ✅ Aviso de sucesso na tela
- ✅ Redirecionamento para confirmação
- ✅ Transação aparece em **Stripe Dashboard** → **Payments**

### Para MERCADO PAGO:
1. Mesmos passos acima
2. No formulário MP, use cartão de teste do Mercado Pago
3. Veja em: https://www.mercadopago.com.br/developers/pt-BR/docs/checkout-pro/test-cards

### Para PAYPAL:
1. Mesmos passos acima
2. Será redirecionado para login PayPal
3. Use conta teste criada em: https://developer.paypal.com/dashboard

---

## ✅ VERIFICAÇÃO FINAL

Após testar, verifique:

1. **No Supabase**:
   - Tabela `transactions` tem a transação
   - Tabela `items` mostra item como `is_sold = true`
   - Tabela `items_history` tem registro da venda

2. **No Gateway**:
   - Stripe: https://dashboard.stripe.com/payments
   - Mercado Pago: https://www.mercadopago.com.br/admin
   - PayPal: https://www.paypal.com/home

3. **Na Aplicação**:
   - Comprador recebe confirmação
   - Vendedor é notificado
   - Item não aparece mais no catálogo

---

## ⚠️ SEGURANÇA EM PRODUÇÃO

Antes de lançar para usuários reais:

- [ ] Testar com valores pequenos (R$ 1-5)
- [ ] Verificar logs de erro em Supabase (Functions → Logs)
- [ ] Testar reembolsos (se aplicável)
- [ ] Monitorar taxa de sucesso/falha
- [ ] Ter suporte pronto para problemas
- [ ] Fazer backup periódico do banco

---

## 🆘 TROUBLESHOOTING

### "Gateway não configurado"
- Verificar se `gateway_provider` está preenchido
- Verificar se `gateway_mode = 'production'`
- Recarregar a aplicação (F5)

### "Chaves inválidas"
- Copiou chaves **SEM espaços**?
- As chaves de **PRODUCTION** estão preenchidas?
- Não misturou Sandbox com Production?

### Webhook não recebe eventos
- URL está exata no painel Stripe?
- Edge Function está deployada?
- Ver logs em Supabase → Functions → Logs

### Transação não aparece no banco
- Verifique se `process-transaction` function foi deployada
- Ver logs em Supabase → Functions → Logs
- Testar criar transação manual no SQL

---

## 🎉 PRÓXIMOS PASSOS

Quando tudo estiver funcionando:

1. Criar anúncios reais com seus CDs
2. Começar a receber pagamentos
3. Monitorar regularmente as transações
4. Ajustar taxas conforme necessário
5. Escalar a marketing/users

---

## 📞 SUPORTE RÁPIDO

**Problema** | **Solução**
---|---
Página de pagamento branca | Abrir F12 → Console, enviar erro
Pagamento recusado | Usar cartão de teste correto
Webhook não funciona | Verificar URL exata no painel
Edge Function erro 500 | Ver logs em Supabase

---

**Boa sorte! 🍀 Você está pronto para aceitar pagamentos reais!**

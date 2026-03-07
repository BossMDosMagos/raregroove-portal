# ✅ CHECKLIST DE DEPLOY - SEGURANÇA

## 🔒 PRÉ-REQUISITOS

```
┌─────────────────────────────────────────────────────────┐
│  ANTES DE FAZER DEPLOY, EXECUTE ESTE CHECKLIST         │
│  Marque cada item como concluído                        │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 FASE 1: SETUP DO BANCO DE DADOS

### 1.1 Criar Tabela de Webhook Logs
```
□ Abrir Supabase Dashboard
□ Ir em SQL Editor
□ Abrir arquivo: SQL-CREATE-WEBHOOK-LOGS.sql
□ Copiar TODO o conteúdo
□ Executar no SQL Editor
□ Verificar sucesso: "✅ Tabela webhook_logs criada: SIM"
```

**Validação**:
```sql
SELECT COUNT(*) FROM webhook_logs; -- Deve retornar 0 (tabela vazia mas criada)
```

---

## 🔐 FASE 2: CONFIGURAR SECRETS

### 2.1 Stripe Webhook Secret
```
□ Abrir Stripe Dashboard
□ Ir em: Developers → Webhooks
□ Click "Add endpoint"
□ URL: https://[SEU-PROJETO].supabase.co/functions/v1/stripe-webhook
□ Selecionar eventos:
   □ payment_intent.succeeded
   □ payment_intent.payment_failed
   □ charge.refunded
□ Copiar "Signing secret" (começa com whsec_)
```

**Configurar no Supabase**:
```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

**Validação**:
```bash
supabase secrets list | grep STRIPE_WEBHOOK_SECRET
# Deve mostrar: STRIPE_WEBHOOK_SECRET (set)
```

### 2.2 Stripe Secret Key
```
□ Copiar Secret Key do Stripe (sk_live_... ou sk_test_...)
```

**Configurar no Supabase**:
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_xxxxxxxxxxxxx
```

---

## 🚀 FASE 3: DEPLOY DAS EDGE FUNCTIONS

### 3.1 Deploy Stripe Payment Intent (Atualizada)
```bash
cd supabase/functions
supabase functions deploy stripe-create-payment-intent
```

**Validação**:
```
□ Output mostra: "Deployed function stripe-create-payment-intent"
□ Testar: curl https://[projeto].supabase.co/functions/v1/stripe-create-payment-intent
   (deve retornar headers de segurança)
```

### 3.2 Deploy Stripe Webhook (Nova)
```bash
supabase functions deploy stripe-webhook
```

**Validação**:
```
□ Output mostra: "Deployed function stripe-webhook"
□ No Stripe Dashboard → Webhooks: "Send test webhook"
□ Verificar logs: supabase functions logs stripe-webhook
   (deve mostrar: "✅ Assinatura do webhook validada")
```

---

## 🍯 FASE 4: TESTAR HONEY POT

### 4.1 Signup Form
```
□ Abrir aplicação em modo incógnito
□ Ir para página de cadastro
□ Abrir DevTools (F12) → Console
□ Executar: document.querySelector('[name="address_secondary_field"]')
   (deve retornar o input oculto)
□ Tentar preencher via console: 
   document.querySelector('[name="address_secondary_field"]').value = 'test'
□ Submeter formulário
□ Verificar erro: "ACESSO NEGADO"
```

### 4.2 Swap Proposal Modal
```
□ Logar como usuário com itens
□ Abrir item de outro vendedor
□ Clicar "Trocar"
□ Abrir DevTools → Console
□ Executar: document.querySelector('[name="website_url"]')
   (deve retornar o input oculto)
□ Tentar preencher e submeter
□ Verificar bloqueio
```

---

## ⏱️ FASE 5: TESTAR RATE LIMITING

### 5.1 Teste de Carga
```bash
# Instalar ferramenta de teste (opcional)
npm install -g autocannon

# Executar teste de carga
autocannon -c 20 -d 5 \
  -H "Authorization: Bearer [TOKEN]" \
  -m POST \
  https://[projeto].supabase.co/functions/v1/stripe-create-payment-intent
```

**Validação**:
```
□ Após ~10 requisições, deve retornar HTTP 429
□ Verificar logs: "🚨 Rate limit excedido para IP"
□ Aguardar 60s e tentar novamente (deve funcionar)
```

### 5.2 Signup Cooldown
```
□ Tentar criar conta (signup)
□ Ver mensagem: "E-MAIL DE ATIVAÇÃO ENVIADO"
□ Tentar criar outra conta imediatamente
□ Botão deve estar desabilitado e mostrando: "Aguarde 60s"
```

---

## 💰 FASE 6: VALIDAR VALORES DO BACKEND

### 6.1 Criar Transação de Teste
```
□ Logar como Vendedor
□ Criar item de teste (ex: R$ 100)
□ Logar como Comprador
□ Enviar mensagem ao vendedor
□ Vendedor: Clicar "Fechar Negócio"
□ Confirmar negociação
```

### 6.2 Iniciar Pagamento
```
□ Comprador: Ver transação criada
□ Tentar modificar valor no DevTools (Network tab)
   - Interceptar requisição para stripe-create-payment-intent
   - Alterar transaction_id para ID inexistente
   - Enviar requisição
□ Verificar erro: "Transação não encontrada"
```

**Validação**:
```
□ Backend NÃO aceita valores do frontend
□ Backend busca valores do Supabase
□ Logs mostram: "💰 Valores da transação: {itemPrice: 100, ...}"
```

---

## 🔐 FASE 7: TESTAR WEBHOOK SIGNATURE

### 7.1 Webhook Válido (Stripe CLI)
```bash
# Instalar Stripe CLI (se ainda não tem)
brew install stripe/stripe-cli/stripe # macOS
# ou: scoop install stripe # Windows

# Login
stripe login

# Escutar webhooks
stripe listen --forward-to https://[projeto].supabase.co/functions/v1/stripe-webhook

# Em outro terminal, enviar teste
stripe trigger payment_intent.succeeded
```

**Validação**:
```
□ Logs mostram: "✅ Assinatura do webhook validada"
□ Transação atualizada no banco (status='pago')
□ Webhook log criado na tabela webhook_logs
```

### 7.2 Webhook Inválido (Sem Assinatura)
```bash
curl -X POST https://[projeto].supabase.co/functions/v1/stripe-webhook \
  -H "Content-Type: application/json" \
  -d '{"fake": "webhook"}'
```

**Validação**:
```
□ Deve retornar: HTTP 401 "Assinatura inválida"
□ Logs mostram: "❌ Assinatura do webhook ausente"
□ Transação NÃO é atualizada (proteção funcionando)
```

---

## 🛡️ FASE 8: VERIFICAR SECURITY HEADERS

### 8.1 Testar Headers
```bash
curl -I https://[projeto].supabase.co/functions/v1/stripe-create-payment-intent
```

**Validação - Deve conter**:
```
□ X-Content-Type-Options: nosniff
□ X-Frame-Options: DENY
□ X-XSS-Protection: 1; mode=block
□ Strict-Transport-Security: max-age=31536000
□ Referrer-Policy: strict-origin-when-cross-origin
□ Content-Security-Policy: default-src 'self'
```

### 8.2 Testar Proteção XSS
```
□ Tentar inserir script em campo de mensagem: <script>alert('xss')</script>
□ Submeter formulário
□ Verificar que script NÃO é executado (sanitizado)
```

---

## 📊 FASE 9: MONITORAMENTO

### 9.1 Configurar Logs
```
□ Abrir Supabase Dashboard → Logs
□ Adicionar filtro: Functions → stripe-create-payment-intent
□ Adicionar filtro: Functions → stripe-webhook
```

### 9.2 Queries de Monitoramento
```sql
-- Últimos webhooks recebidos
SELECT id, provider, event_type, created_at 
FROM webhook_logs 
ORDER BY created_at DESC 
LIMIT 10;

-- Taxa de webhooks por hora (últimas 24h)
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total
FROM webhook_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

**Validação**:
```
□ Webhooks aparecem na tabela em tempo real
□ Logs do Supabase mostram atividade
□ Sem erros críticos nos últimos 10 eventos
```

---

## 🚨 FASE 10: TESTE DE PENETRAÇÃO (OPCIONAL MAS RECOMENDADO)

### 10.1 SQL Injection
```
□ Tentar injetar SQL em campo de texto:
   ' OR 1=1--
   '; DROP TABLE users--
□ Verificar que RLS bloqueia
```

### 10.2 CSRF
```
□ Tentar requisição cross-origin sem token
□ Verificar CORS/autenticação bloqueando
```

### 10.3 Brute Force
```
□ Tentar 20 logins errados seguidos
□ Verificar rate limit bloqueando após 5-10 tentativas
```

---

## ✅ CHECKLIST FINAL

```
ANTES DE IR PARA PRODUÇÃO:

Database:
□ Tabela webhook_logs criada
□ RLS ativado em todas tabelas
□ Índices criados

Secrets:
□ STRIPE_WEBHOOK_SECRET configurado
□ STRIPE_SECRET_KEY configurado
□ Outros secrets necessários

Edge Functions:
□ stripe-create-payment-intent deployada
□ stripe-webhook deployada
□ Logs sem erros

Security:
□ Honey pot testado e bloqueando bots
□ Rate limiting bloqueando requisições excessivas
□ Validação backend de valores funcionando
□ Webhook signature validando corretamente
□ Security headers presentes em todas respostas

Tests:
□ Signup com honey pot bloqueado
□ Swap proposal com honey pot bloqueado
□ Rate limit funcionando (429 após limite)
□ Valores validados no backend (não frontend)
□ Webhook válido processado
□ Webhook inválido rejeitado (401)
□ Headers de segurança presentes

Monitoring:
□ Logs configurados
□ Queries de monitoramento testadas
□ Alertas configurados (opcional)
```

---

## 🎉 DEPLOY COMPLETO!

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ✅ SEGURANÇA IMPLEMENTADA E TESTADA                    │
│                                                         │
│  Seu sistema está protegido contra:                    │
│  • Bots (Honey Pot)                                    │
│  • Brute Force (Rate Limiting)                          │
│  • Manipulação de Valores (Backend Validation)         │
│  • Webhooks Falsos (Signature Verification)            │
│  • Ataques Comuns (Security Headers + RLS)             │
│                                                         │
│  Próximos passos:                                       │
│  1. Monitorar logs diariamente                         │
│  2. Revisar security alerts semanalmente               │
│  3. Atualizar dependências mensalmente                 │
│  4. Audit de segurança trimestral (recomendado)        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

**Data**: 5 de Março de 2026  
**Autor**: GitHub Copilot (Claude Sonnet 4.5)  
**Status**: ✅ PRONTO PARA PRODUÇÃO

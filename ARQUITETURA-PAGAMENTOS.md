# 🏗️ ARQUITETURA DE PAGAMENTOS - RAREGROOVE

## 📐 VISÃO GERAL

Sistema de pagamentos reais implementado com arquitetura segura, escalável e multi-gateway.

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Checkout   │  │ SwapPayment  │  │PaymentSuccess│     │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘     │
│         │                  │                                 │
│         └─────────┬────────┘                                │
│                   ▼                                          │
│         ┌─────────────────────┐                             │
│         │  PaymentGateway.jsx │ (Orchestrator)              │
│         └─────────┬───────────┘                             │
│                   │                                          │
│         ┌─────────┴─────────┐                               │
│         ▼         ▼         ▼                                │
│    ┌────────┐ ┌────┐ ┌────────┐                            │
│    │ Stripe │ │ MP │ │ PayPal │                            │
│    │  Form  │ │Form│ │  Form  │                            │
│    └────┬───┘ └──┬─┘ └───┬────┘                            │
└─────────┼────────┼───────┼──────────────────────────────────┘
          │        │       │
          ▼        ▼       ▼
┌─────────────────────────────────────────────────────────────┐
│              SUPABASE EDGE FUNCTIONS (Deno)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  stripe-create-payment-intent                        │   │
│  │  mp-create-preference                                │   │
│  │  paypal-create-order                                 │   │
│  │  paypal-capture-order                                │   │  
│  │  process-transaction (Universal Processor)           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  DATABASE (PostgreSQL)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  • transactions                                      │   │
│  │  • shipping                                          │   │
│  │  • items (is_sold, sold_at, sold_to_user_id)        │   │
│  │  • swaps (guarantee_fee_X_paid)                     │   │
│  │  • user_balances (pending_balance)                  │   │
│  │  • financial_ledger (audit trail)                   │   │
│  │  • platform_settings (API keys, fees)               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 SEGURANÇA - DESIGN PRINCIPLES

### 1. **Separação Cliente/Servidor**

❌ **NUNCA NO FRONTEND:**
- Secret API Keys
- Access Tokens privados
- Processing fees calculations
- Direct database writes (bypass RLS)

✅ **SEMPRE NO FRONTEND:**
- Publishable Keys (public)
- UI rendering
- User input
- Client-side validations

✅ **SEMPRE NO BACKEND (Edge Functions):**
- Secret Keys
- Payment Intent creation
- Order creation/capture
- Database mutations com SERVICE_ROLE_KEY
- Business logic (fees, balances)

### 2. **RLS (Row Level Security)**

Todas as tabelas têm políticas RLS:
- `transactions`: Apenas buyer/seller veem sua transação
- `shipping`: Apenas buyer/seller veem seu envio
- `items`: Todos veem, apenas owner edita
- `swaps`: Apenas user_1/user_2 veem
- `user_balances`: Apenas próprio usuário vê seu saldo
- `financial_ledger`: Admin only

### 3. **Validações em Camadas**

```
Frontend Validation → Edge Function Validation → Database Constraints
     (UX)                    (Security)                (Data Integrity)
```

---

## 💳 FLUXO DE PAGAMENTO - STRIPE

### Arquitetura:

```
User → Checkout.jsx → PaymentGateway → StripePaymentForm
                                              │
                                              ▼
                                    CardElement (@stripe/react-stripe-js)
                                              │
                                              ▼ (user preenche cartão)
                                              │
                         ┌────────────────────┴────────────────────┐
                         │                                         │
                         ▼                                         ▼
              stripe-create-payment-intent           confirmCardPayment
              (Edge Function)                        (client-side SDK)
                         │                                         │
                         ▼                                         │
              Stripe API (server-side)                             │
              Creates PaymentIntent                                │
              Returns clientSecret                                 │
                         │                                         │
                         └─────────────────┬─────────────────────┘
                                           │
                                           ▼ (paymentIntent.succeeded)
                                    process-transaction
                                    (Edge Function)
                                           │
                                           ▼
                              Database Updates:
                              - Create transaction
                              - Create shipping
                              - Mark item sold
                              - Update seller balance
                              - Log ledger
                                           │
                                           ▼
                                    /payment/success
```

### Código:

**Frontend (StripePaymentForm):**
```jsx
const handleSubmit = async (e) => {
  e.preventDefault();
  
  // 1. Create PaymentIntent (server-side)
  const { clientSecret } = await createStripePaymentIntent(
    amount, 
    metadata, 
    config
  );
  
  // 2. Confirm payment (client-side)
  const result = await stripe.confirmCardPayment(clientSecret, {
    payment_method: { card: cardElement }
  });
  
  if (result.error) {
    onError(result.error);
  } else {
    onSuccess({ paymentId: result.paymentIntent.id, provider: 'stripe' });
  }
};
```

**Backend (Edge Function):**
```typescript
// stripe-create-payment-intent/index.ts
const stripe = new Stripe(secretKey);

const paymentIntent = await stripe.paymentIntents.create({
  amount: Math.round(amount),
  currency: 'brl',
  automatic_payment_methods: { enabled: true }
});

return { clientSecret: paymentIntent.client_secret };
```

---

## 💚 FLUXO DE PAGAMENTO - MERCADO PAGO

### Arquitetura:

```
User → PaymentGateway → MercadoPagoPaymentForm
                                │
                                ▼
                    mp-create-preference
                    (Edge Function)
                                │
                                ▼
                    Mercado Pago API
                    Creates Preference
                    Returns init_point (URL)
                                │
                                ▼
                    window.location = init_point
                    (Redirect to MP checkout)
                                │
                                ▼
                    User completes payment on MP
                                │
                                ▼
                    MP Webhook → process-transaction
                    (Backend handles confirmation)
                                │
                                ▼
                    Database Updates
                                │
                                ▼
                    Redirect back to site
```

**IMPORTANTE:** Mercado Pago usa redirect flow, não embedded form.

---

## 💙 FLUXO DE PAGAMENTO - PAYPAL

### Arquitetura:

```
User → PaymentGateway → PayPalPaymentForm
                                │
                                ▼
                    PayPal Buttons SDK
                    (window.paypal.Buttons)
                                │
                     ┌──────────┴──────────┐
                     │                     │
                createOrder            onApprove
                     │                     │
                     ▼                     ▼
        paypal-create-order      paypal-capture-order
        (Edge Function)          (Edge Function)
                     │                     │
                     ▼                     ▼
        PayPal API v2           PayPal API v2
        /checkout/orders        /orders/{id}/capture
                     │                     │
                     └──────────┬──────────┘
                                │
                                ▼
                        process-transaction
                        (Edge Function)
                                │
                                ▼
                        Database Updates
                                │
                                ▼
                        /payment/success
```

**IMPORTANTE:** PayPal usa embedded buttons, não redirect.

---

## 🔄 TRANSACTION PROCESSOR - process-transaction

### Função Universal para 2 Tipos de Transação:

#### 1. **VENDA (transactionType: 'venda')**

```typescript
// 1. Create transaction record
const transaction = {
  buyer_id,
  seller_id,
  item_id,
  amount: totalBuyer,
  net_amount: netAmountSeller,
  platform_fee,
  processing_fee,
  shipping_cost,
  insurance_cost,
  status: 'pago_em_custodia',
  payment_provider: provider,
  payment_id: paymentId
};

// 2. Create shipping record
const shipping = {
  transaction_id,
  buyer_id,
  seller_id,
  item_id,
  from_cep: shipping.from_cep,
  to_cep: shipping.to_cep,
  to_address: shipping.to_address,
  estimated_cost: shipping_cost,
  has_insurance: insurance_included,
  insurance_cost,
  status: 'awaiting_label'
};

// 3. Mark item as sold
UPDATE items 
SET is_sold = true, 
    sold_to_user_id = buyer_id, 
    sold_at = NOW()
WHERE id = item_id;

// 4. Update seller balance
INSERT INTO user_balances (user_id, pending_balance)
VALUES (seller_id, net_amount)
ON CONFLICT (user_id) 
DO UPDATE SET pending_balance = user_balances.pending_balance + net_amount;

// 5. Log financial ledger
INSERT INTO financial_ledger (
  user_id,
  source_type: 'venda',
  source_id: transaction_id,
  amount: net_amount,
  description: `Venda do item ${item_title}`
);
```

#### 2. **SWAP FEE (transactionType: 'swap_fee')**

```typescript
// 1. Update swap guarantee fee status
const user_field = isUser1 
  ? 'guarantee_fee_1_paid' 
  : 'guarantee_fee_2_paid';

UPDATE swaps 
SET [user_field] = true
WHERE id = swap_id;

// 2. Check if both paid
const bothPaid = swap.guarantee_fee_1_paid && swap.guarantee_fee_2_paid;

// 3. If both paid, authorize shipping
if (bothPaid) {
  UPDATE swaps 
  SET status = 'autorizado_envio'
  WHERE id = swap_id;
}

// 4. Log ledger
INSERT INTO financial_ledger (
  user_id,
  source_type: 'troca',
  source_id: swap_id,
  amount: guarantee_fee,
  description: 'Taxa de garantia de troca'
);

// 5. Return status
return { success: true, bothPaid };
```

---

## 📊 ESTRUTURA DE DADOS

### Transactions Table:
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  buyer_id UUID REFERENCES auth.users,
  seller_id UUID REFERENCES auth.users,
  item_id UUID REFERENCES items,
  
  -- Valores
  amount NUMERIC(10,2) NOT NULL,        -- Total pago pelo comprador
  net_amount NUMERIC(10,2) NOT NULL,    -- Valor líquido para vendedor
  platform_fee NUMERIC(10,2),           -- Taxa da plataforma
  processing_fee NUMERIC(10,2),         -- Taxa do gateway
  shipping_cost NUMERIC(10,2),          -- Custo do frete
  insurance_cost NUMERIC(10,2),         -- Custo do seguro
  
  -- Status
  status TEXT CHECK (status IN (
    'pago_em_custodia',
    'aguardando_envio',
    'enviado',
    'entregue',
    'cancelado'
  )),
  
  -- Payment provider
  payment_provider TEXT,                -- 'stripe', 'mercado_pago', 'paypal'
  payment_id TEXT,                      -- ID do pagamento no gateway
  
  -- Shipping reference
  shipping_id UUID REFERENCES shipping,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Shipping Table:
```sql
CREATE TABLE shipping (
  shipping_id UUID PRIMARY KEY,
  transaction_id UUID REFERENCES transactions,
  buyer_id UUID REFERENCES auth.users,
  seller_id UUID REFERENCES auth.users,
  item_id UUID REFERENCES items,
  
  -- Endereços
  from_cep TEXT NOT NULL,
  from_address JSONB,
  to_cep TEXT NOT NULL,
  to_address JSONB,
  
  -- Valores
  estimated_cost NUMERIC(10,2),
  final_cost NUMERIC(10,2),
  has_insurance BOOLEAN DEFAULT false,
  insurance_cost NUMERIC(10,2),
  
  -- Status
  status TEXT CHECK (status IN (
    'awaiting_label',
    'label_generated',
    'in_transit',
    'delivered',
    'returned',
    'cancelled'
  )),
  
  -- Tracking
  carrier TEXT,
  tracking_code TEXT,
  label_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);
```

### Swaps Table:
```sql
CREATE TABLE swaps (
  id UUID PRIMARY KEY,
  user_1_id UUID REFERENCES auth.users,
  user_2_id UUID REFERENCES auth.users,
  item_1_id UUID REFERENCES items,
  item_2_id UUID REFERENCES items,
  
  -- Status
  status TEXT CHECK (status IN (
    'aguardando_taxas',
    'autorizado_envio',
    'em_transito',
    'concluido',
    'cancelado'
  )),
  
  -- Garantias
  guarantee_fee_1_paid BOOLEAN DEFAULT false,
  guarantee_fee_2_paid BOOLEAN DEFAULT false,
  guarantee_fee_1_payment_id TEXT,
  guarantee_fee_2_payment_id TEXT,
  
  -- Reservas
  user_1_item_reserved BOOLEAN DEFAULT false,
  user_2_item_reserved BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🧮 CÁLCULO DE TAXAS

### Platform Fee (Taxa da Plataforma):
```javascript
const platformFee = (itemPrice * platformFeePercentage) / 100;
```

### Processing Fee (Taxa do Gateway):
```javascript
const processingFee = (itemPrice * processingFeePercentage) / 100;
```

### Net Amount (Valor Líquido para Vendedor):
```javascript
const netAmount = itemPrice - platformFee - processingFee;
```

### Total Buyer (Total Pago pelo Comprador):
```javascript
const totalBuyer = itemPrice + shippingCost + (insuranceCost || 0);
```

### Exemplo:
```
Item: R$ 100,00
Platform Fee (10%): R$ 10,00
Processing Fee (3%): R$ 3,00
Shipping: R$ 20,00
Insurance: R$ 5,00

Net Amount (Seller): R$ 87,00 (100 - 10 - 3)
Total Buyer: R$ 125,00 (100 + 20 + 5)
```

---

## 🎯 ESTADOS DE TRANSAÇÃO

### Venda:
```
pago_em_custodia → aguardando_envio → enviado → entregue
                                              → cancelado
```

### Swap:
```
aguardando_taxas → autorizado_envio → em_transito → concluido
                                                   → cancelado
```

### Shipping:
```
awaiting_label → label_generated → in_transit → delivered
                                              → returned
                                              → cancelled
```

---

## 📁 ESTRUTURA DE ARQUIVOS

```
src/
├── components/
│   └── PaymentGateway.jsx          # Orchestrator + 3 forms
├── pages/
│   ├── Checkout.jsx                # Sale flow
│   ├── SwapPayment.jsx             # Swap fee flow
│   └── PaymentSuccess.jsx          # Success page
└── utils/
    └── paymentGateway.js           # Service layer

supabase/
└── functions/
    ├── stripe-create-payment-intent/
    │   └── index.ts
    ├── mp-create-preference/
    │   └── index.ts
    ├── paypal-create-order/
    │   └── index.ts
    ├── paypal-capture-order/
    │   └── index.ts
    └── process-transaction/
        └── index.ts

SQL/
├── SQL-CHECKOUT-LOGISTICA.sql      # Tables + RLS
└── SQL-FIX-RLS-PLATFORM-SETTINGS.sql
```

---

## 🚀 DEPLOYMENT CHECKLIST

### Development (Sandbox):
- [x] Edge Functions deployed
- [x] NPM packages installed
- [x] SQL executed
- [x] Sandbox API keys configured
- [x] gateway_mode = 'sandbox'
- [ ] Test all flows with test cards
- [ ] Verify database updates
- [ ] Test error scenarios

### Production:
- [ ] Change gateway_mode to 'production'
- [ ] Configure production API keys
- [ ] Setup webhooks for all gateways
- [ ] Configure monitoring/alerts
- [ ] Setup error tracking (Sentry)
- [ ] Load test with staging environment
- [ ] Security audit
- [ ] Backup database
- [ ] Enable rate limiting
- [ ] Test rollback procedure

---

## 🎓 CONCEITOS IMPORTANTES

### PaymentIntent (Stripe):
Representa uma intenção de pagamento. Criado server-side com valor e metadata. Cliente confirma com método de pagamento.

### Preference (Mercado Pago):
Representa um checkout. Criado server-side com items e valores. Cliente é redirecionado para página do MP.

### Order (PayPal):
Representa um pedido. Criado server-side com purchase_units. Cliente aprova via PayPal SDK. Capturado server-side após aprovação.

### Custódia (Escrow):
Pagamento fica retido até comprador confirmar recebimento do item. Protege ambas as partes.

### RLS (Row Level Security):
Políticas de segurança no PostgreSQL que restringem acesso a linhas baseado no usuário autenticado.

### SERVICE_ROLE_KEY:
Chave administrativa do Supabase que bypassa RLS. Usar APENAS em Edge Functions, NUNCA no frontend.

---

## 📚 DOCUMENTAÇÃO OFICIAL

- **Stripe**: https://stripe.com/docs/api
- **Mercado Pago**: https://www.mercadopago.com.br/developers/pt/docs
- **PayPal**: https://developer.paypal.com/docs/api/overview/
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions
- **Supabase RLS**: https://supabase.com/docs/guides/auth/row-level-security

---

**SISTEMA PRONTO PARA PROCESSAR PAGAMENTOS REAIS! 🎉**

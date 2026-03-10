# 🔧 FIX: CORS Headers nas Edge Functions

## Problema Identificado
Erro ao chamar Edge Function:
```
Access to fetch at 'https://hlfirfukbrisfpebaaur.supabase.co/functions/v1/mp-create-preference' 
from origin 'http://localhost:5173' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check
```

**Causa:** Faltava header `Access-Control-Allow-Methods` na resposta CORS.

---

## Alterações Realizadas

### Arquivo 1: `supabase/functions/mp-create-preference/index.ts`
**Antes:**
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

**Depois:**
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

### Arquivo 2: `supabase/functions/stripe-create-payment-intent/index.ts`
Mesmo fix aplicado - adicionado `'Access-Control-Allow-Methods': 'POST, OPTIONS'`

### Arquivo 3: `supabase/functions/paypal-create-order/index.ts`
Mesmo fix aplicado - adicionado `'Access-Control-Allow-Methods': 'POST, OPTIONS'`

### Arquivo 4: `supabase/functions/paypal-capture-order/index.ts`
Mesmo fix aplicado - adicionado `'Access-Control-Allow-Methods': 'POST, OPTIONS'`

---

## Deploy das Alterações

### Opção 1: Supabase CLI (Recomendado)
```bash
cd C:\PROJETO-RAREGROOVE-3.0
npx supabase functions deploy mp-create-preference
npx supabase functions deploy stripe-create-payment-intent
npx supabase functions deploy paypal-create-order
npx supabase functions deploy paypal-capture-order
```

Se pedir autenticação, execute:
```bash
npx supabase login
```

### Opção 2: Supabase Dashboard
1. Acesse: https://app.supabase.com
2. Abra seu projeto
3. Vá para: **Edge Functions**
4. Clique em cada função e copie o código corrigido do seu projeto local
5. Clique em **Deploy**

---

## Próximos Passos

Após fazer o deploy das Edge Functions:
1. Recarregue o navegador (CTRL+R ou CMD+R)
2. Vá até o Checkout
3. Clique em **CONTINUAR PARA PAGAMENTO** com Mercado Pago
4. A requisição agora deve passar no preflight CORS

Se ainda não funcionar:
- Abra Console (F12)
- Procure pelos logs `📤 [MP]` e `📥 [MP]`
- Compartilhe qualquer erro que aparecer

---

## Por que Acontecia?

Quando o navegador faz um POST para um domínio diferente (CORS), ele primeiro faz um preflight request com método OPTIONS para verificar permissões.

O servidor precisa responder com:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS  ← FALTAVA ISSO
Access-Control-Allow-Headers: ...
```

Sem o `Access-Control-Allow-Methods`, o navegador rejeita a requisição real do POST.

---

## Resultado Esperado

✅ Requisição preflight (OPTIONS) → Sucesso
✅ Requisição real (POST) → Sucesso
✅ Redirecionamento para Mercado Pago Checkout

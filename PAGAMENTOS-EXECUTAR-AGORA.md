# 🚀 EXECUTAR AGORA - PAGAMENTOS REAIS

## ✅ O QUE FOI IMPLEMENTADO

Sistema completo de pagamentos reais integrado com:
- **Stripe** (cartão de crédito)
- **Mercado Pago** (diversos métodos)
- **PayPal** (conta PayPal)

## 📋 PASSO A PASSO PARA ATIVAR

### 1️⃣ EXECUTAR SCRIPTS SQL NO SUPABASE

Execute os seguintes scripts **NA ORDEM** no SQL Editor do Supabase:

```sql
-- 1. Fix RLS para platform_settings (se ainda não executou)
-- Abra: SQL-FIX-RLS-PLATFORM-SETTINGS.sql
-- Execute no Supabase SQL Editor

-- 2. Criar tabelas de checkout e logística
-- Abra: SQL-CHECKOUT-LOGISTICA.sql
-- Execute no Supabase SQL Editor
```

**Como executar:**
1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto RareGroove
3. Vá em: SQL Editor (no menu lateral)
4. Cole o conteúdo do arquivo SQL
5. Clique em "RUN" (canto inferior direito)
6. Aguarde mensagem de sucesso ✅

---

### 2️⃣ INSTALAR PACOTES NPM

Execute no terminal:

```powershell
npm install @stripe/stripe-js @stripe/react-stripe-js
```

**Pacotes instalados:**
- ✅ `@stripe/stripe-js` - SDK do Stripe para web
- ✅ `@stripe/react-stripe-js` - Componentes React do Stripe

**NOTA:** Mercado Pago e PayPal são carregados via CDN (já implementado no código).

---

### 3️⃣ FAZER DEPLOY DAS EDGE FUNCTIONS

Execute **um por vez** no terminal (na pasta raiz do projeto):

```powershell
# Ir para pasta raiz
cd C:\PROJETO-RAREGROOVE-3.0

# Deploy de cada Edge Function
supabase functions deploy stripe-create-payment-intent
supabase functions deploy mp-create-preference  
supabase functions deploy paypal-create-order
supabase functions deploy paypal-capture-order
supabase functions deploy process-transaction
```

**IMPORTANTE:** 
- Aguarde cada deploy finalizar antes de executar o próximo
- Verifique se não há erros no log
- As funções aparecerão em: Supabase Dashboard → Edge Functions

---

### 4️⃣ CONFIGURAR CHAVES DE API (SANDBOX)

1. **Acesse a página de configuração:**
   - URL: `http://localhost:5173/admin/fees` (ou sua URL de produção)

2. **Configure o Gateway:**
   - Gateway Provider: `stripe` (para começar)
   - Gateway Mode: `sandbox` (para testes)

3. **Obtenha as chaves do Stripe:**
   - Acesse: https://dashboard.stripe.com/test/apikeys
   - Copie:
     - **Publishable key** (começa com `pk_test_...`)
     - **Secret key** (começa com `sk_test_...`)

4. **Cole as chaves:**
   - Publishable Key Sandbox: `pk_test_...`
   - Secret Key Sandbox: `sk_test_...`
   - Clique em **SALVAR**

---

## 🧪 TESTAR FLUXO DE VENDA

### Teste Completo (Compra de Item):

1. **Navegar para catálogo:**
   ```
   http://localhost:5173/catalogo
   ```

2. **Selecionar um item e clicar em "COMPRAR"**

3. **Preencher dados de entrega:**
   - CEP de teste: `01311100` (Av. Paulista, SP)
   - Clique em "Buscar"
   - Selecione uma opção de frete
   - Marque "Adicionar Seguro" (opcional)

4. **Clicar em "Continuar para Pagamento"**

5. **Pagar com cartão de teste:**
   - Número do cartão: `4242 4242 4242 4242`
   - Validade: `12/34`
   - CVC: `123`
   - Nome: `Teste Silva`

6. **Clicar em "Pagar"**

7. **Aguardar confirmação:**
   - Deve ver "Processando pagamento..."
   - Depois: "Pagamento confirmado!"
   - Redirecionamento para `/payment/success`

### ✅ Verificar no Banco de Dados:

Execute no Supabase SQL Editor:

```sql
-- Verificar transação criada
SELECT * FROM transactions 
ORDER BY created_at DESC 
LIMIT 5;

-- Verificar registro de frete
SELECT * FROM shipping 
ORDER BY created_at DESC 
LIMIT 5;

-- Verificar item marcado como vendido
SELECT id, title, is_sold, sold_at 
FROM items 
WHERE is_sold = true 
ORDER BY sold_at DESC 
LIMIT 5;

-- Verificar saldo do vendedor
SELECT user_id, pending_balance 
FROM user_balances 
ORDER BY updated_at DESC 
LIMIT 5;

-- Verificar ledger financeiro
SELECT * FROM financial_ledger 
ORDER BY created_at DESC 
LIMIT 5;
```

---

## 🔄 TESTAR FLUXO DE TROCA (SWAP)

### Teste Completo (Proposta de Troca):

1. **Navegar para item desejado:**
   ```
   http://localhost:5173/item/:itemId
   ```

2. **Clicar em "TROCAR"**

3. **Selecionar seu item no modal**

4. **Clicar em "Propor Troca"**
   - Swap criado com status `aguardando_taxas`
   - **Redirecionamento automático** para `/swap-payment/:swapId`

5. **Pagar taxa de garantia:**
   - Ver ambos os itens (o que oferece / o que recebe)
   - Clicar em "Pagar Taxa de Garantia"
   - Usar cartão de teste: `4242 4242 4242 4242`
   - Confirmar pagamento

6. **Status após pagamento:**
   - Se você pagou primeiro: "Taxa paga! Aguardando o outro usuário..."
   - Se ambos pagaram: "Ambos pagaram! Agora vocês podem gerar etiquetas de envio."

### ✅ Verificar Swap no Banco:

```sql
-- Verificar swap criado
SELECT * FROM swaps 
ORDER BY created_at DESC 
LIMIT 5;

-- Ver status das taxas
SELECT 
  id,
  status,
  guarantee_fee_1_paid,
  guarantee_fee_2_paid,
  created_at
FROM swaps 
ORDER BY created_at DESC;
```

---

## 🎨 OUTROS GATEWAYS (OPCIONAL)

### Mercado Pago:

1. **Obter chaves:**
   - Acesse: https://www.mercadopago.com.br/developers/panel/credentials
   - Copie Public Key e Access Token (modo sandbox)

2. **Configurar:**
   - Gateway Provider: `mercado_pago`
   - Gateway Mode: `sandbox`
   - Public Key Sandbox: `TEST-...`
   - Access Token Sandbox: `TEST-...`

3. **Testar:**
   - No checkout, será redirecionado para página do Mercado Pago
   - Use usuário de teste do MP
   - Após pagamento, retorna para o site

### PayPal:

1. **Obter credenciais:**
   - Acesse: https://developer.paypal.com/dashboard/applications/sandbox
   - Crie um app (se não tiver)
   - Copie Client ID e Secret (sandbox)

2. **Configurar:**
   - Gateway Provider: `paypal`
   - Gateway Mode: `sandbox`
   - Client ID Sandbox: `...`
   - Client Secret Sandbox: `...`

3. **Testar:**
   - No checkout, verá botões do PayPal
   - Clique em "PayPal"
   - Login com conta sandbox
   - Aprove pagamento

---

## 🐛 TROUBLESHOOTING

### Erro: "Cannot read properties of undefined (reading 'invoke')"
**Solução:** Edge Functions não foram deployadas. Execute os comandos de deploy.

### Erro: "Gateway não configurado"
**Solução:** Configure as chaves de API em `/admin/fees`.

### Erro: "Invalid API Key"
**Solução:** Verifique se copiou as chaves corretamente (sandbox vs production).

### Pagamento aprovado mas transação não criada
**Solução:** 
1. Verifique logs da Edge Function `process-transaction` no Supabase
2. Verifique se o usuário tem permissão (RLS policies)

### Item não marcado como vendido
**Solução:** Execute SQL para verificar:
```sql
SELECT * FROM items WHERE id = 'SEU_ITEM_ID';
```

### Saldo não atualizado
**Solução:** Verifique se a tabela `user_balances` existe e tem RLS policies corretas.

---

## 📊 PRÓXIMOS PASSOS

✅ **Sistema está pronto para:**
- Receber pagamentos REAIS em sandbox
- Processar transações de venda
- Processar taxas de garantia de troca
- Marcar items como vendidos
- Atualizar saldos de vendedores
- Registrar tudo no ledger financeiro

⚠️ **ANTES DE IR PARA PRODUÇÃO:**
- [ ] Testar todos os fluxos em sandbox
- [ ] Configurar webhooks dos gateways
- [ ] Criar página `/payment/failure` para erros
- [ ] Implementar geração de etiquetas de frete
- [ ] Configurar chaves de PRODUÇÃO (não sandbox)
- [ ] Testar em ambiente staging
- [ ] Revisar políticas RLS

---

## 📞 SUPPORT

Se encontrar problemas:
1. Verifique console do navegador (F12)
2. Verifique logs das Edge Functions no Supabase
3. Verifique se todos os SQLs foram executados
4. Verifique se as chaves estão corretas

**IMPORTANTE:** Este sistema está usando pagamentos REAIS em modo sandbox. 
Em sandbox, nenhum dinheiro real é processado. Use apenas cartões de teste.

---

## 🎉 TUDO PRONTO!

Agora você tem um sistema completo de pagamentos reais integrado!

**Fluxo de venda:** Catálogo → Item → Comprar → Checkout → Pagamento Real → Sucesso

**Fluxo de troca:** Item → Trocar → Selecionar Item → Pagar Taxa → Aguardar Outro Usuário → Gerar Etiquetas

**Arquivos criados nesta implementação:**
- ✅ 5 Edge Functions em `supabase/functions/`
- ✅ `src/utils/paymentGateway.js` (serviço de integração)
- ✅ `src/components/PaymentGateway.jsx` (UI de pagamento)
- ✅ `src/pages/Checkout.jsx` (atualizado com pagamentos reais)
- ✅ `src/pages/SwapPayment.jsx` (pagamento de taxa de troca)
- ✅ `src/pages/PaymentSuccess.jsx` (página de confirmação)
- ✅ `SQL-CHECKOUT-LOGISTICA.sql` (schemas do banco)
- ✅ `SQL-FIX-RLS-PLATFORM-SETTINGS.sql` (fix de políticas)

**COMECE PELOS 4 PASSOS ACIMA E BOA SORTE! 🚀**

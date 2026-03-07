# 🚀 DEPLOY: Edge Functions com CORS Corrigido

## ⚡ Resumo do Problema
- **Erro:** `Access to fetch has been blocked by CORS policy`
- **Causa:** Faltava header `Access-Control-Allow-Methods: POST, OPTIONS`
- **Solução:** Adicionado aos 4 Edge Functions

## 📋 Arquivos Corrigidos
✅ `supabase/functions/mp-create-preference/index.ts`
✅ `supabase/functions/stripe-create-payment-intent/index.ts`
✅ `supabase/functions/paypal-create-order/index.ts`
✅ `supabase/functions/paypal-capture-order/index.ts`

---

## 🔐 Opção 1: Deploy via CLI com Token (Recomendado)

### Passo 1: Obter Token de Acesso Supabase
1. Abra: https://app.supabase.com
2. Clique seu nome (canto superior direito)
3. Selecione **Access Tokens**
4. Clique **Generate New Token**
5. Dê um nome: "Deploy Payment Functions"
6. Clique **Generate**
7. **Copie o token** (guardar num local seguro)

### Passo 2: Executar Deploy

**No PowerShell:**
```powershell
cd C:\PROJETO-RAREGROOVE-3.0

# Setar variável de ambiente com o token
$env:SUPABASE_ACCESS_TOKEN = "seu_token_aqui"

# Fazer o deploy de cada função
npx supabase functions deploy mp-create-preference
npx supabase functions deploy stripe-create-payment-intent
npx supabase functions deploy paypal-create-order
npx supabase functions deploy paypal-capture-order
```

**Ou execute o script (mais fácil):**
```powershell
cd C:\PROJETO-RAREGROOVE-3.0
.\DEPLOY-EDGE-FUNCTIONS.bat
```

---

## 🌐 Opção 2: Deploy via Dashboard

### Passo 1: Para cada função...

#### 1️⃣ mp-create-preference
1. Acesse: https://app.supabase.com → seu projeto
2. Vá para: **Edge Functions** (menu lateral)
3. Clique: **mp-create-preference**
4. Copie TODO O CÓDIGO deste arquivo:
   - `supabase/functions/mp-create-preference/index.ts`
5. Cole no editor do Supabase Dashboard
6. Clique: **Deploy**

#### 2️⃣ stripe-create-payment-intent
Repita o mesmo para: `supabase/functions/stripe-create-payment-intent/index.ts`

#### 3️⃣ paypal-create-order
Repita o mesmo para: `supabase/functions/paypal-create-order/index.ts`

#### 4️⃣ paypal-capture-order
Repita o mesmo para: `supabase/functions/paypal-capture-order/index.ts`

---

## ✅ Verificação

Após fazer o deploy:

1. **Recarregue o navegador**
   ```
   CTRL + R  (ou CMD + R no Mac)
   ```

2. **Vá ao Checkout**
   - Adicione um produto
   - Clique em "CONTINUAR PARA PAGAMENTO"

3. **Teste Mercado Pago**
   - Selecione "Mercado Pago"
   - Clique "CONTINUAR PARA PAGAMENTO"
   - Você deve ser redirecionado para o checkout do Mercado Pago

4. **Abra Console** (F12) se aparecer erro
   - Procure por logs `📤 [MP]` ou `📥 [MP]`
   - Compartilhe qualquer erro que vir

---

## 🐛 Se Ainda der Erro

### Erro: "Failed to send request to Edge Function"
```
Possíveis causas:
1. Deploy não foi concluído (espere 30 segundos)
2. Token expirado (tente novo)
3. Código ainda não foi compilado (recarregue página)
```

**Ação:**
- Aguarde 30 segundos
- Recarregue a página do navegador (F5)
- Tente novamente

### Erro: CORS ainda aparecendo
```
Se em console ainda aparecer:
"Access to fetch has been blocked by CORS policy"
```

**Significa:** Deploy não completou ou código antigo ainda está em cache.

**Ação:**
- Limpe cache com CTRL+SHIFT+DEL
- Selecioneer "Cached images and files"
- Tente novamente

---

## 📊 Checklist Final

- [ ] Fiz login no Supabase CLI ou usei Dashboard
- [ ] Fiz deploy das 4 funções
- [ ] Aguardei 30 segundos
- [ ] Recarreguei o navegador
- [ ] Testei Mercado Pago no checkout
- [ ] Fui redirecionado para checkout do MP
- [ ] ✅ Problema resolvido!

---

## 🆘 Ainda precisa de ajuda?

Se o problema persistir:
1. Abra Console (F12)
2. Clique em "CONTINUAR PARA PAGAMENTO"
3. Copie TODOS os logs que aparecem
4. Compartilhe comigo
5. Vamos debug juntos


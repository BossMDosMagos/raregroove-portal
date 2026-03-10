# 💳 CARTÕES DE TESTE - GATEWAYS DE PAGAMENTO

## 🎨 STRIPE - Cartões de Teste

### ✅ Aprovados (Sucesso):
```
Número: 4242 4242 4242 4242
Validade: Qualquer data futura (ex: 12/34)
CVC: Qualquer 3 dígitos (ex: 123)
Nome: Qualquer nome

Resultado: ✅ Pagamento aprovado imediatamente
```

### ❌ Recusados (Teste de Erro):
```
Número: 4000 0000 0000 0002
Validade: 12/34
CVC: 123
Nome: Teste Recusado

Resultado: ❌ Card declined
```

### 🔐 Requer Autenticação (3D Secure):
```
Número: 4000 0027 6000 3184
Validade: 12/34
CVC: 123
Nome: Teste 3DS

Resultado: 🔐 Abre modal de autenticação
```

### 💰 Saldo Insuficiente:
```
Número: 4000 0000 0000 9995
Validade: 12/34
CVC: 123
Nome: Teste Sem Saldo

Resultado: ❌ Insufficient funds
```

### Mais cartões: https://stripe.com/docs/testing#cards

---

## 💙 MERCADO PAGO - Usuários de Teste

### Como criar usuários de teste:

1. Acesse: https://www.mercadopago.com.br/developers/panel/test-users
2. Clique em "Criar usuário de teste"
3. Selecione: Brasil
4. Quantidade de dinheiro: R$ 1000
5. Tipo: Comprador

### Usuário Comprador Padrão (já criado pelo MP):
```
Email: test_user_123456@testuser.com
Senha: qatest123

Dinheiro disponível: R$ 1000+
```

### Cartões de teste no Mercado Pago:

#### ✅ Mastercard Aprovado:
```
Número: 5031 4332 1540 6351
Validade: 11/25
CVC: 123
Nome: APRO (sempre aprovado)
```

#### ✅ Visa Aprovado:
```
Número: 4235 6477 2802 5682
Validade: 11/25
CVC: 123
Nome: APRO
```

#### ❌ Cartão Recusado:
```
Número: 5031 4332 1540 6351
Validade: 11/25
CVC: 123
Nome: OTROC (sempre recusado)
```

### Estados de pagamento para testes:

| Nome no Cartão | Status | Descrição |
|----------------|--------|-----------|
| APRO | approved | Pagamento aprovado |
| CONT | pending | Pagamento pendente |
| OTROC | rejected | Recusado por limite de crédito |
| EXPI | rejected | Recusado por validade expirada |
| FORM | rejected | Recusado por erro no formulário |
| CALL | rejected | Autorização recusada |

### Mais cartões: https://www.mercadopago.com.br/developers/pt/docs/checkout-api/testing

---

## 💸 PAYPAL - Contas Sandbox

### Como criar contas sandbox:

1. Acesse: https://developer.paypal.com/dashboard/accounts
2. Clique em "Create Account"
3. Tipo: Personal (Buyer)
4. País: Brazil
5. Saldo: $1000

### Conta de Teste Padrão (Personal):
```
Email: sb-buyer@business.example.com
Senha: test1234

Saldo: $1000 USD
```

### Conta Business (Vendedor):
```
Email: sb-seller@business.example.com
Senha: test1234

(Use apenas se testar como vendedor)
```

### Fluxo de teste:
1. No checkout, clique em "PayPal"
2. Faça login com email de teste
3. Aprove o pagamento
4. Será redirecionado de volta

### IMPORTANTE:
- ⚠️ Use sempre contas sandbox em modo sandbox
- ⚠️ Nunca use email/senha real do PayPal em sandbox
- ⚠️ Saldo é virtual, não é dinheiro real

### Mais sobre sandbox: https://developer.paypal.com/tools/sandbox/accounts/

---

## 🧪 CENÁRIOS DE TESTE

### ✅ Teste 1: Compra Simples (Sucesso)
```
Gateway: Stripe
Cartão: 4242 4242 4242 4242
Resultado Esperado: Pagamento aprovado, item vendido, saldo atualizado
```

### ❌ Teste 2: Compra Recusada
```
Gateway: Stripe
Cartão: 4000 0000 0000 0002
Resultado Esperado: Erro "Card declined", transação não criada
```

### 🔒 Teste 3: Autenticação 3D Secure
```
Gateway: Stripe
Cartão: 4000 0027 6000 3184
Resultado Esperado: Modal de autenticação, depois aprovado
```

### 💳 Teste 4: Mercado Pago Aprovado
```
Gateway: Mercado Pago
Cartão: 5031 4332 1540 6351
Nome: APRO
Resultado Esperado: Redirecionado para MP, pagamento aprovado
```

### 💙 Teste 5: PayPal Sandbox
```
Gateway: PayPal
Login: sb-buyer@business.example.com
Senha: test1234
Resultado Esperado: Login, aprova, retorna ao site
```

### 🔄 Teste 6: Taxa de Garantia Swap
```
Gateway: Stripe
Cartão: 4242 4242 4242 4242
Fluxo: Propor troca → Pagar taxa → Aguardar outro usuário
Resultado Esperado: Taxa paga, aguardando outro usuário
```

### 👥 Teste 7: Swap Completo (2 Usuários)
```
Usuário 1: Propõe troca e paga taxa
Usuário 2: Recebe notificação e paga taxa
Resultado Esperado: Status "autorizado_envio", ambos podem gerar etiquetas
```

---

## 📝 CHECKLIST DE TESTES

### Antes de testar:
- [ ] SQL executado (tabelas criadas)
- [ ] Edge Functions deployadas
- [ ] Pacotes NPM instalados
- [ ] Chaves de API configuradas em /admin/fees
- [ ] Gateway mode = 'sandbox'

### Testes de Venda:
- [ ] Item exibido no catálogo
- [ ] Botão "COMPRAR" funciona
- [ ] CEP validado e endereço carregado
- [ ] Opções de frete calculadas
- [ ] Seguro adicionável (opcional)
- [ ] Total calculado corretamente
- [ ] Formulário de pagamento exibido
- [ ] Cartão de teste aceito
- [ ] Pagamento processado
- [ ] Redirecionado para /payment/success
- [ ] Item marcado como vendido (is_sold=true)
- [ ] Transação criada no banco
- [ ] Shipping criado no banco
- [ ] Saldo do vendedor atualizado (pending_balance)
- [ ] Ledger registrado

### Testes de Troca:
- [ ] Botão "TROCAR" funciona
- [ ] Modal exibe items do usuário
- [ ] Proposta de troca criada
- [ ] Redirecionamento automático para /swap-payment
- [ ] Ambos items exibidos corretamente
- [ ] Taxa de garantia calculada
- [ ] Pagamento processado
- [ ] Status atualizado (guarantee_fee_X_paid=true)
- [ ] Após ambos pagarem, status = 'autorizado_envio'

### Testes de Erros:
- [ ] Cartão recusado mostra mensagem de erro
- [ ] Sem CEP mostra validação
- [ ] Sem gateway configurado mostra alerta
- [ ] API key inválida mostra erro
- [ ] Timeout mostra mensagem apropriada

---

## 🐛 DEBUGGING

### Console do Navegador (F12):
```javascript
// Verificar config do gateway
console.log(await supabase.from('platform_settings').select('*').single())

// Verificar sessão
console.log(await supabase.auth.getSession())

// Testar Edge Function manualmente
console.log(await supabase.functions.invoke('stripe-create-payment-intent', {
  body: { amount: 5000, currency: 'brl', metadata: {} }
}))
```

### SQL para Debug:
```sql
-- Ver últimas transações
SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10;

-- Ver shipping
SELECT * FROM shipping ORDER BY created_at DESC LIMIT 10;

-- Ver items vendidos
SELECT * FROM items WHERE is_sold = true ORDER BY sold_at DESC LIMIT 10;

-- Ver saldos
SELECT * FROM user_balances ORDER BY updated_at DESC LIMIT 10;

-- Ver ledger
SELECT * FROM financial_ledger ORDER BY created_at DESC LIMIT 10;

-- Ver swaps
SELECT * FROM swaps ORDER BY created_at DESC LIMIT 10;
```

---

## 🎯 PRÓXIMOS PASSOS APÓS TESTES

1. ✅ **Testar todos os cartões acima**
2. ✅ **Verificar cada passo no banco de dados**
3. ✅ **Testar os 3 gateways (Stripe, MP, PayPal)**
4. ✅ **Testar fluxo de venda completo**
5. ✅ **Testar fluxo de swap completo**
6. 📧 **Configurar webhooks para notificações**
7. 🚢 **Implementar geração real de etiquetas de frete**
8. 🔔 **Adicionar notificações por email**
9. 🏷️ **Criar página "Meus Pedidos"**
10. 🚀 **Configurar produção (chaves reais)**

---

## ⚠️ IMPORTANTE

- **SANDBOX vs PRODUCTION:**
  - Sandbox: Usa cartões de teste, nenhum $ real
  - Production: Usa cartões reais, $ real processado
  
- **NUNCA misture:**
  - ❌ Chaves sandbox com mode production
  - ❌ Chaves production com mode sandbox
  - ❌ Cartões reais em sandbox
  - ❌ Cartões de teste em production

- **ANTES DE IR PARA PRODUÇÃO:**
  - Teste TUDO em sandbox primeiro
  - Configure webhooks
  - Revise políticas RLS
  - Faça backup do banco
  - Configure monitoring/alertas
  - Teste com pequeno grupo de usuários beta

---

## 📞 LINKS ÚTEIS

- **Stripe Test Cards:** https://stripe.com/docs/testing
- **Mercado Pago Test Users:** https://www.mercadopago.com.br/developers/pt/docs/checkout-api/testing
- **PayPal Sandbox:** https://developer.paypal.com/tools/sandbox/
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions
- **Supabase RLS:** https://supabase.com/docs/guides/auth/row-level-security

---

**BOA SORTE COM OS TESTES! 🚀💳**

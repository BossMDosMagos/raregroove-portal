# ⚡ Quick Setup - Ativar Pagamentos em 2 Minutos

## O Problema
Checkout diz: "Nenhum banco de pagamento configurado"

## A Solução
Adicionar credenciais de teste do Stripe (a mais fácil para começar)

## Passo 1: Obter suas chaves do Stripe

1. Acesse: https://dashboard.stripe.com/test/apikeys
2. Você verá:
   - **Publishable key** (começa com `pk_test_`)
   - **Secret key** (começa com `sk_test_`)
3. Copie ambas para um notepad temporário

## Passo 2: Executar SQL no Supabase

1. Abra seu projeto no [Supabase Console](https://supabase.com)
2. Clique em **SQL Editor** → **New Query**
3. Cole este SQL:

```sql
UPDATE platform_settings
SET 
  stripe_publishable_key_sandbox = 'COLE_AQUI_SUA_CHAVE_PUBLICA',
  stripe_secret_key_sandbox = 'COLE_AQUI_SUA_CHAVE_SECRETA',
  stripe_webhook_secret_sandbox = 'whsec_test_123456789',
  gateway_mode = 'sandbox',
  gateway_provider = 'stripe'
WHERE id = 1;
```

4. **Substitua os valores**:
   - `COLE_AQUI_SUA_CHAVE_PUBLICA` → colar chave publica (pk_test_...)
   - `COLE_AQUI_SUA_CHAVE_SECRETA` → colar chave secreta (sk_test_...)

5. Clique em **RUN**

## Passo 3: Verificar no Checkout

1. Volte para o app
2. Abra um item para comprar
3. Clique em **COMPRAR AGORA**
4. Agora você deve ver: **💳 Stripe** como opção de pagamento

## Pronto! 🎉

Agora você pode testar o fluxo de pagamento com credenciais de teste do Stripe.

---

## Cartões de teste do Stripe

Para testar pagamentos, use estes cartões:

| Cenário | Número | CVC | Data |
|---------|--------|-----|------|
| ✅ Aprovado | `4242 4242 4242 4242` | Qualquer | Qualquer futura |
| ❌ Recusado | `4000 0000 0000 0002` | Qualquer | Qualquer futura |
| ⚠️ Requer Auth 3D | `4000 0025 0000 3155` | Qualquer | Qualquer futura |

**Nome**: Qualquer coisa  
**Email**: Qualquer coisa  
**Mês/Ano**: Qualquer data no futuro

---

## Próximos Passos

Depois de testar com Stripe, você pode adicionar:
- **Mercado Pago** (veja `GUIA-CONFIGURAR-PAGAMENTOS.md`)
- **PayPal** (veja `GUIA-CONFIGURAR-PAGAMENTOS.md`)

E então o checkout oferecerá as 3 opções simultâneas! 🎯

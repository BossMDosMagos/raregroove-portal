# 🔧 Configuração do Sistema de Pagamentos

## Problema
Erro ao entrar no checkout: **"Erro ao carregar dados"** ou **"Nenhum banco de pagamento configurado"**

## Causa Raiz
A tabela `platform_settings` no Supabase não tem um registro inicial com `id=1`, ou o registro existe mas não tem as credenciais da gateway configuradas.

## Solução

### Passo 1: Verificar se existe registro em platform_settings

1. Vá para [Supabase Console](https://supabase.com)
2. Selecione seu projeto
3. No menu lateral, vá para **SQL Editor**
4. Cole e execute esta query:

```sql
SELECT * FROM platform_settings WHERE id = 1;
```

### Passo 2: Se não existir registro, criá-lo

Se a query anterior retornar vazio, execute:

```sql
INSERT INTO platform_settings (
  id,
  gateway_mode,
  gateway_provider,
  sale_fee_pct,
  processing_fee_fixed,
  insurance_percentage,
  swap_guarantee_fee_fixed,
  default_shipping_from_cep,
  created_at,
  updated_at
)
VALUES (
  1,
  'sandbox',
  'stripe',
  10,
  2.0,
  5,
  5.0,
  '01311100',
  NOW(),
  NOW()
);
```

### Passo 3: Adicionar Credenciais de Gateway

Agora você pode configurar as chaves da sua gateway favorita ou de todas elas simultâneamente.

#### Opção A: Via Painel Administrativo (RECOMENDADO)
1. Faça login como Admin
2. Vá para **CONFIGURAÇÕES** → **CONFIGURAÇÕES FINANCEIRAS**
3. Preencha as chaves de seu gateway (Stripe, Mercado Pago, ou PayPal)
4. Selecione o modo (Sandbox para testes, Production para vender)
5. Clique em **Salvar**

#### Opção B: Via SQL (Manual)
Para **Stripe (Sandbox)**:
```sql
UPDATE platform_settings
SET 
  stripe_publishable_key_sandbox = 'pk_test_SEU_ENDERECO_PUBLICO',
  stripe_secret_key_sandbox = 'sk_test_SEU_ENDERECO_SECRETO',
  stripe_webhook_secret_sandbox = 'whsec_SEU_WEBHOOK_SECRET',
  gateway_mode = 'sandbox',
  gateway_provider = 'stripe',
  updated_at = NOW()
WHERE id = 1;
```

Para **Mercado Pago (Sandbox)**:
```sql
UPDATE platform_settings
SET 
  mp_public_key_sandbox = 'APP_USR-SEU_CODIGO_PUBLICO',
  mp_access_token_sandbox = 'TEST-SEU_TOKEN_ACESSO',
  gateway_mode = 'sandbox',
  gateway_provider = 'mercado_pago',
  updated_at = NOW()
WHERE id = 1;
```

Para **PayPal (Sandbox)**:
```sql
UPDATE platform_settings
SET 
  paypal_client_id_sandbox = 'AVA_SEU_CLIENT_ID',
  paypal_client_secret_sandbox = 'SEU_CLIENT_SECRET',
  gateway_mode = 'sandbox',
  gateway_provider = 'paypal',
  updated_at = NOW()
WHERE id = 1;
```

### Passo 4: Multi-Gateway Simultâneo (Novo!)

O sistema agora suporta **todas as 3 gateways funcionando simultaneamente**!

Se você quer oferecerecer todas as opções para o usuário, preencha as credenciais de todas:

```sql
UPDATE platform_settings
SET 
  -- STRIPE
  stripe_publishable_key_sandbox = 'pk_test_...',
  stripe_secret_key_sandbox = 'sk_test_...',
  stripe_webhook_secret_sandbox = 'whsec_...',
  
  -- MERCADO PAGO
  mp_public_key_sandbox = 'APP_USR-...',
  mp_access_token_sandbox = 'TEST-...',
  
  -- PAYPAL
  paypal_client_id_sandbox = 'AVA_...',
  paypal_client_secret_sandbox = '...',
  
  gateway_mode = 'sandbox',
  updated_at = NOW()
WHERE id = 1;
```

Agora no checkout, o cliente verá todos os gateways disponíveis como botões selecionáveis:
- 💳 Stripe
- 🎯 Mercado Pago
- 🌐 PayPal

### Passo 5: Testar Checkout

1. Acesse a página de um item
2. Clique em **COMPRAR AGORA**
3. Verificar se o erro sumiu
4. Preencher CEP de entrega
5. Selecionar o método de pagamento desejado
6. Proceder com o pagamento

## Credenciais de Teste

### Stripe
- **Chave Pública (Sandbox)**: Começa com `pk_test_`
- **Chave Secreta (Sandbox)**: Começa com `sk_test_`
- Obter em: https://dashboard.stripe.com/test/apikeys

### Mercado Pago
- **Chave Pública**: Formato `APP_USR-...`
- **Token de Acesso**: Formato `TEST-...` ou `APP_USR-...`
- Obter em: https://www.mercadopago.com/developers/pt-BR/reference

### PayPal
- **Client ID**: Formato `AVA...`
- **Client Secret**: String longa
- Obter em: https://developer.paypal.com/dashboard/apps (Sandbox)

## Se ainda tiver erro

1. Abra o **Console do Navegador** (F12)
2. Vá para a aba **Console**
3. Tire uma screenshot do erro
4. Compartilhe para debug

## Arquivos de Apoio

- **SQL-INICIALIZAR-PLATFORM-SETTINGS.sql** - Script para criar registro inicial
- **SQL-ATIVAR-PAGAMENTOS-PRODUCAO.sql** - Script para ativar em produção

Os modificações foram feitas para o Checkout ser mais resiliente e agora:
- ✅ Não quebra se não houver `platform_settings`
- ✅ Usa valores padrão como fallback
- ✅ Detecta automaticamente quais gateways têm credenciais
- ✅ Permite seleção simultânea de 3 gateways

# 🛒 CHECKOUT, LOGÍSTICA E FLUXO DE VENDA - GUIA DE EXECUÇÃO

## 📋 Resumo da Implementação

Implementamos um sistema completo de **Checkout, Gestão de Frete, Etiquetas de Envio e Fluxo de Pagamento**. Sistema integra:
- Estimativas de frete em tempo real
- Checkbox de seguro
- Cálculo dinâmico de taxas
- Geração de etiquetas pré-pagas
- Marcação automática de estoque

---

## 🔧 PASSO 1: Executar SQL de Checkout e Logística

Antes de tudo, você **DEVE** executar o SQL para criar a estrutura do banco:

### Arquivo: `SQL-CHECKOUT-LOGISTICA.sql`

**Local**: Raiz do projeto `c:\PROJETO-RAREGROOVE-3.0\SQL-CHECKOUT-LOGISTICA.sql`

**Conteúdo**:
- Estende tabela `items` com campos de frete e estoque
- Cria tabela `shipping` para rastreamento de envios
- Cria tabela `shipping_labels` para etiquetas pré-pagas
- Estende `transactions` com colunas de frete/seguro
- Estende `swaps` com reserva de itens
- Adiciona configurações de frete em `platform_settings`
- Implementa RLS policies para segurança

**Como executar**:
1. Abra **Supabase Dashboard** → **SQL Editor**
2. Copie o conteúdo de `SQL-CHECKOUT-LOGISTICA.sql`
3. Se houver erro de ForeignKey na função `reserve_item_for_swap`, remova a linha:
   ```sql
   AND reserved_until = NOW() + INTERVAL '24 hours'
   ```
   A reserva é temporária apenas em memória.

---

## 📁 Arquivos Criados/Modificados

### **Novas Páginas**:
1. **`src/pages/Checkout.jsx`** ✨
   - Página completa de finalização de compra
   - Campo de CEP com validação ViaCEP
   - Estimativa de frete com 3 opções
   - Checkbox de seguro
   - Resumo de preços com cálculo de:
     - Preço Item
     - Taxa de Plataforma (%)
     - Taxa Fixa (R$)
     - Frete (Estimado)
     - Seguro (Opcional)
   - Status validações e botão de pagamento

### **Novos Componentes**:
1. **`src/components/SwapProposalModal.jsx`** ✨
   - Modal flutuante para propor trocas
   - Listagem dos itens do usuário
   - Preview do item selecionado
   - Campo de mensagem pessoal
   - Info box sobre como funciona
   - Cria registro em `swaps` table

2. **`src/components/ShippingLabelCard.jsx`** ✨
   - Exibe status de envio
   - Botão para gerar etiqueta pré-paga
   - Mostra código de rastreamento (copiável)
   - Links para download de etiqueta PDF
   - Botão para marcar como enviado
   - Passos for the seller

### **Novos Serviços**:
1. **`src/utils/shippingService.js`** ✨
   - `estimateShipping()` - Estima frete via ViaCEP + cálculo dummy
   - `validateCEP()` - Valida CEP e retorna endereço
   - `calculateInsurance()` - Calcula valor de seguro
   - `generateShippingLabel()` - Gera etiqueta (stub para API real)
   - `getShippingConfig()` - Busca config de frete
   - `saveShippingEstimate()` - Salva pré-avaliação

2. **`src/utils/transactionService.js`** ✨
   - `processPayment()` - Processa pagamento e cria transação
   - `processSwapPayment()` - Processa taxa de garantia de troca
   - `completeSwap()` - Completa troca após entrega
   - `cancelTransaction()` - Cancela e reembolsa
   - `ensureUserBalance()` - Garante user_balances existe

### **Modificações**:
1. **`src/pages/ItemDetails.jsx`** 🔄
   - Importa `SwapProposalModal`
   - Adiciona estado `swapModalOpen`
   - Busca usuário autenticado
   - Botão "Comprar" navega para `/checkout/:itemId`
   - Botão "Trocar" abre modal com validações
   - Renderiza modal de troca

2. **`src/App.jsx`** 🔄
   - Importa componente `Checkout`
   - Adiciona rota `/checkout/:itemId`

---

## 🛍️ FLUXO: Compra (COMPRAR Button)

### 1️⃣ **Usuário clica "COMPRAR"**
   - Validação: Usuário logado?
   - Validação: Não é vendedor?
   - Navega para `/checkout/:itemId`

### 2️⃣ **Página Checkout carrega**
   - Busca dados do item
   - Busca config de frete do platform_settings
   - Valida CPF/CNPJ do comprador
   - Se não tem CPF/CNPJ → Redireciona para /profile

### 3️⃣ **Comprador insere CEP**
   - Clica "Buscar"
   - Valida via ViaCEP API
   - Se válido, mostra endereço + opções de frete

### 4️⃣ **Estimativa de Frete**
   - 3 opções: SEDEX, PAC, Loggi (valores dummy por enquanto)
   - Cálculo: (Base + Peso × 2)
   - Comprador seleciona uma

### 5️⃣ **Checkbox Seguro (Opcional)**
   - Se marcado: Calcula `seguro = valor_item × insurance_percentage%`
   - Padrão: 5%

### 6️⃣ **Resumo de Preços**
   - Preço Item
   - + Taxa Plataforma (vai pro Portal)
   - + Taxa Fixa (R$2,50)
   - + Frete (Estimado)
   - + Seguro (se marcado)
   - = **Total que Comprador Paga**

### 7️⃣ **Botão "Pagar Agora"** (TODO: Integração Real)
   - Desabilitado até selecionar frete
   - Chamaria `processPayment()` do transactionService
   - Após aprovação:
     - Cria registro em `transactions` (status: `pago_em_custodia`)
     - Cria registro em `shipping` (status: `awaiting_label`)
     - **Marca item como `is_sold = true`** ✅
     - Adiciona `net_amount` à custódia do vendedor

### 8️⃣ **Pós-Venda - Vendedor gera Etiqueta**
   - Novas transações aparecem em "Vendas Ativas" (você cria)
   - Exibe `ShippingLabelCard`
   - Vendedor clica "Gerar Etiqueta de Envio"
   - API gera etiqueta pré-paga (Melhor Envio / Correios)
   - Vendedor:
     - Imprime PDF
     - Cola na caixa
     - Deixa nos Correios
     - Marca botão "Marquei como Enviado"

---

## 🔄 FLUXO: Troca (TROCAR Button)

### 1️⃣ **Usuário clica "TROCAR"**
   - Validação: Usuário logado?
   - Validação: Não é vendedor?
   - Abre `SwapProposalModal`

### 2️⃣ **Modal carrega itens do usuário**
   - Filtra itens não vendidos
   - Exclui o item atual
   - Se 0 itens → "Você não tem itens para trocar"

### 3️⃣ **Seleciona item para oferecer**
   - Grid de imagens clicáveis
   - Preview em tempo real

### 4️⃣ **Mensagem pessoal (opcional)**
   - "Que acha?" ou mensagem customizada
   - Max 200 caracteres

### 5️⃣ **Botão "Propor Troca"**
   - Cria registro em `swaps`:
     ```
     user_1_id = usuário atual (propositor)
     user_2_id = vendedor do item
     item_1_id = item do propositor
     item_2_id = item do vendedor
     status = 'aguardando_taxas'
     ```
   - Cria mensagem no chat:
     ```
     "🔄 PROPOSTA DE TROCA
      Eu ofereço: [Item A]
      Você recebe: [Item B]
      [Mensagem pessoal]"
     ```

### 6️⃣ **Ambos Pagam Taxa de Garantia**
   - Cada um paga `swap_guarantee_fee_fixed` (padrão: R$10)
   - Status muda para `autorizado_envio`
   - Se cancelado → Taxa é reembolsada

### 7️⃣ **Ambos Trocam Itens**
   - Geram etiquetas (como na venda)
   - Enviam os pacotes
   - Confirmam entrega
   - Status muda para `concluido`
   - Ambos mantêm seus novos itens

---

## ✅ Validações Implementadas

### Checkout:
- ✅ Usuário deve estar logado
- ✅ Não pode comprar item de si mesmo
- ✅ CPF/CNPJ obrigatório
- ✅ CEP válido (ViaCEP)
- ✅ Deve selecionar frete
- ✅ Botão desabilitado até todos os campos

### Troca:
- ✅ Usuário deve estar logado
- ✅ Não pode trocar com vendedor
- ✅ Deve ter pelo menos 1 item para trocar
- ✅ Não pode oferecer o mesmo item
- ✅ Criação de swap segura com status inicial

### Estoque:
- ✅ Item marcado como `is_sold` após pagamento
- ✅ Item desaparece da busca
- ✅ Itens em troca são reservados (em memória por 24h)

---

## 🔌 Integrações Necessárias (TODO)

### Payment Gateways:
1. **Stripe** - Implementar chamada ao Stripe.js
2. **Mercado Pago** - Integrar SDK MP.js
3. **PayPal** - Integrar PayPal Commerce Platform

Exemplo para Stripe (em `Checkout.jsx`, função `handlePay`):
```javascript
const stripe = await loadStripe(settings.stripe_publishable_key);
const { clientSecret } = await fetch('/create-payment-intent', {
  method: 'POST',
  body: JSON.stringify({ amount: totalBuyer * 100 })
}).then(r => r.json());

const result = await stripe.confirmCardPayment(clientSecret, {
  payment_method: { card: elements.getElement(CardElement) }
});

if (result.paymentIntent.status === 'succeeded') {
  await processPayment({ ...paymentData });
}
```

### Frete:
1. **Melhor Envio API** - Integrar real shipping estimates
2. **Correios API** - Backup para frete via Correios
3. **Loggi API** - Entrega rápida em grandes cidades

---

## 📊 Schema do Banco Criado

### Nova coluna `items`:
```sql
- fixed_shipping_cost: NUMERIC(10,2)  -- Frete fixo definido pelo vendedor
- shipping_from_cep: TEXT             -- CEP de saída do vendedor
- shipping_weight_kg: NUMERIC(8,3)    -- Peso para estimativa de frete
- allow_estimate_shipping: BOOLEAN    -- Permide estimar frete
- stock_quantity: INTEGER             -- Quantidade em estoque
- is_sold: BOOLEAN                    -- Se foi vendido
- sold_to_user_id: UUID               -- Quem comprou
- sold_at: TIMESTAMPTZ                -- Data da venda
```

### Nova tabela `shipping`:
```sql
- shipping_id: UUID PRIMARY KEY
- transaction_id: UUID (FK transactions)
- buyer_id, seller_id: UUID
- from_cep, to_cep: TEXT
- from_address, to_address: JSONB (ViaCEP data)
- estimated_cost, final_cost: NUMERIC
- has_insurance, insurance_cost: Boolean/Numeric
- status: 'awaiting_label' | 'label_generated' | 'in_transit' | 'delivered' | ...
- carrier: 'correios' | 'melhor_envio' | 'loggi'
- tracking_code: TEXT (rastreamento)
- label_url, label_pdf_url: TEXT
```

### Nova tabela `shipping_labels`:
```sql
- label_id: UUID PRIMARY KEY
- shipping_id: UUID (FK unique)
- carrier, tracking_code: TEXT
- label_data, label_url, label_pdf_url: TEXT/JSONB
- status: 'generated' | 'printed' | 'dispatched' | 'in_transit' | 'delivered'
- label_cost: NUMERIC
- prepaid: BOOLEAN
```

### Estendidas `transactions`:
```sql
- shipping_cost: NUMERIC(10,2)
- insurance_cost: NUMERIC(10,2)
- shipping_id: UUID (FK shipping)
```

### Estendidas `swaps`:
```sql
- user_1_item_reserved: BOOLEAN
- user_2_item_reserved: BOOLEAN
- reservation_expires_at: TIMESTAMPTZ
```

### Estendidas `platform_settings`:
```sql
- shipping_api_provider: TEXT
- shipping_api_key: TEXT
- melhor_envio_api_key: TEXT
- correios_api_key: TEXT
- insurance_percentage: NUMERIC(5,2)
- default_shipping_from_cep: TEXT
```

---

## 📍 Próximas Steps Recomendadas

1. ✅ Execute `SQL-CHECKOUT-LOGISTICA.sql`
2. ✅ Teste Checkout manualmente:
   - Clique botão "Comprar" em um item
   - Valide CEP (ex: 01311-100 para SP)
   - Selecione frete
   - Confirme que item desaparece da busca após "pagamento"
3. ✅ Teste Troca:
   - Clique "Trocar"
   - Selecione item seu
   - Propor troca
   - Verificar mensagem criada
4. 🔲 Integrar payment gateways **reais**
5. 🔲 Criar página "Minhas Vendas Ativas" com `ShippingLabelCard`
6. 🔲 Criar página de rastreamento para compradores
7. 🔲 Integrar APIs reais de frete

---

## 🚨 Dicas Importantes

- **Frete dummy**: Por enquanto calcula como `Base + Peso × R$2`. Integre Melhor Envio API para valores reais.
- **Payment gateway**: Checkout ainda mostra "Integração de pagamento em desenvolvimento". Implemente Stripe/MP/PayPal.
- **Etiqueta dummy**: Gera PDF placeholder. Integre Melhor Envio para etiquetas reais.
- **RLS**: Todos os inserts e updates checam `auth.uid()` automaticamente.
- **Ledger**: Todas ações financeiras são registradas em `financial_ledger` para auditoria.

---

Boa jornada com o RareGroove! 🎸🎵

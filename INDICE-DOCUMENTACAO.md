# 📦 RAREGROOVE - Índice de Documentação

## 🚀 Guias de Início Rápido

### 💳 Sistema de Pagamentos Reais (NOVO!)
- **[PAGAMENTOS-EXECUTAR-AGORA.md](PAGAMENTOS-EXECUTAR-AGORA.md)** 🔥 - Configurar pagamentos reais!
- [ARQUITETURA-PAGAMENTOS.md](ARQUITETURA-PAGAMENTOS.md) - Arquitetura técnica completa
- [CARTOES-TESTE.md](CARTOES-TESTE.md) - Cartões e contas de teste (Stripe, MP, PayPal)
- [SQL-CHECKOUT-LOGISTICA.sql](SQL-CHECKOUT-LOGISTICA.sql) - Tabelas de checkout e frete
- [SQL-FIX-RLS-PLATFORM-SETTINGS.sql](SQL-FIX-RLS-PLATFORM-SETTINGS.sql) - Fix políticas RLS

### Sistema de Transações
- **[TRANSACOES-EXECUTAR-AGORA.md](TRANSACOES-EXECUTAR-AGORA.md)** ⚡ - Execute primeiro isso!
- [SISTEMA-TRANSACOES-GUIA.md](SISTEMA-TRANSACOES-GUIA.md) - Documentação completa
- [SQL-Create-Transactions-Table.sql](SQL-Create-Transactions-Table.sql) - Script do banco
- [SQL-Consultas-Transacoes.sql](SQL-Consultas-Transacoes.sql) - Queries úteis

### Sistema de Reviews (Avaliações)
- **[REVIEWS-EXECUTAR-AGORA.md](REVIEWS-EXECUTAR-AGORA.md)** ⚡ - Execute depois das transações!
- [SISTEMA-REVIEWS-GUIA-COMPLETO.md](SISTEMA-REVIEWS-GUIA-COMPLETO.md) - Documentação completa
- [SQL-Create-Reviews-Table.sql](SQL-Create-Reviews-Table.sql) - Script do banco
- [SQL-Consultas-Reviews.sql](SQL-Consultas-Reviews.sql) - Queries úteis

---

## 📋 Outros Sistemas Implementados

### Chat e Notificações
- [CORREÇÕES-CHAT-NOTIFICACOES.md](CORREÇÕES-CHAT-NOTIFICACOES.md)
- [EXECUTAR-AGORA.md](EXECUTAR-AGORA.md) - Setup inicial do chat
- [DEBUGGING-REALTIME.md](DEBUGGING-REALTIME.md)

### Avatars
- [AVATARS-GUIA-RAPIDO.md](AVATARS-GUIA-RAPIDO.md)
- [AVATARS-SISTEMA-COMPLETO.md](AVATARS-SISTEMA-COMPLETO.md)
- [SQL-Setup-Avatars-Storage.sql](SQL-Setup-Avatars-Storage.sql)

### Perfis e Segurança
- [INTEGRACAO-PROFILE-SEGURANCA.md](INTEGRACAO-PROFILE-SEGURANCA.md)
- [SETUP-PROFILES-GUIA-RAPIDO.md](SETUP-PROFILES-GUIA-RAPIDO.md)
- [SQL-Create-Profiles-Table.sql](SQL-Create-Profiles-Table.sql)
- [SQL-RLS-Policies-LIMPO.sql](SQL-RLS-Policies-LIMPO.sql)

### Proteção e Spam
- [PROTECAO-ANTI-SPAM.md](PROTECAO-ANTI-SPAM.md)

### Clonagem Visual
- [PROCEDIMENTOS-CLONAGEM-VISUAL.md](PROCEDIMENTOS-CLONAGEM-VISUAL.md)

---

## 🗄️ Scripts SQL Disponíveis

### Setup Essencial (Execute nesta ordem):
1. [SQL-Create-Profiles-Table.sql](SQL-Create-Profiles-Table.sql)
2. [SQL-Setup-Avatars-Storage.sql](SQL-Setup-Avatars-Storage.sql)
3. [SQL-Add-ReadAt-Messages.sql](SQL-Add-ReadAt-Messages.sql)
4. [SQL-Archived-Conversations.sql](SQL-Archived-Conversations.sql)
5. [SQL-Create-Transactions-Table.sql](SQL-Create-Transactions-Table.sql) ⭐
6. [SQL-Create-Reviews-Table.sql](SQL-Create-Reviews-Table.sql) ⭐

### Correções e Debugging:
- [SQL-FIX-COMPLETO.sql](SQL-FIX-COMPLETO.sql)
- [SQL-FIX-SEM-ERRO.sql](SQL-FIX-SEM-ERRO.sql)
- [SQL-FIX-RLS-MESSAGES.sql](SQL-FIX-RLS-MESSAGES.sql)
- [SQL-Verificacao-Debug.sql](SQL-Verificacao-Debug.sql)
- [SQL-VERIFICAR-REALTIME.sql](SQL-VERIFICAR-REALTIME.sql)

### Consultas Úteis:
- [SQL-Consultas-Transacoes.sql](SQL-Consultas-Transacoes.sql)
- [SQL-Consultas-Reviews.sql](SQL-Consultas-Reviews.sql)

---

## 🎯 Funcionalidades Implementadas

### ✅ Core Features
- [x] Sistema de Autenticação (Login/Signup)
- [x] Perfis de Usuário com Avatares
- [x] Catálogo de Produtos (CDs)
- [x] Detalhes de Itens
- [x] Meu Acervo (Gestão de Vendas)
- [x] Lista de Desejos (Wishlist)

### ✅ Comunicação
- [x] Sistema de Chat em Tempo Real
- [x] Notificações (Sininho)
- [x] Contador de Mensagens Não Lidas
- [x] Arquivamento de Conversas
- [x] Proteção Anti-Spam

### ✅ Transações (Novo!)
- [x] Tabela de Transações no Banco
- [x] Botão "Fechar Negócio" no Chat
- [x] Estados: pendente → pago → enviado → concluído
- [x] Badges Visuais (EM NEGOCIAÇÃO / VENDIDO)
- [x] Filtro de Itens Vendidos no Catálogo
- [x] Mensagem Automática do Sistema

### ✅ Reviews & Reputação (Novo!)
- [x] Sistema de Avaliações (1-5 estrelas)
- [x] Comentários Opcionais
- [x] Badge Elite (10+ vendas, 4.8+ rating)
- [x] Seção de Reputação no Perfil
- [x] Rating do Vendedor no ItemDetails
- [x] Rating no Chat
- [x] Estatísticas de Distribuição
- [x] Top 3 Comentários Recentes

### 💳 Pagamentos Reais (NOVO! 🔥)
- [x] Integração Stripe (cartão de crédito)
- [x] Integração Mercado Pago (múltiplos métodos)
- [x] Integração PayPal (conta PayPal)
- [x] Página de Checkout completa
- [x] Cálculo de frete por CEP (ViaCEP)
- [x] Opções de frete (Econômico, Padrão, Expresso)
- [x] Seguro de envio opcional
- [x] Sistema de custódia (escrow)
- [x] Processamento automático de transações
- [x] Atualização de estoque (marca item vendido)
- [x] Gestão de saldos (pending_balance)
- [x] Ledger financeiro (audit trail)
- [x] Taxa de garantia para swaps
- [x] Página de sucesso do pagamento
- [x] 5 Supabase Edge Functions (Deno)
- [x] Suporte sandbox e produção
- [x] Configuração dinâmica de gateway

### ✅ Segurança
- [x] Row Level Security (RLS)
- [x] Políticas de Privacidade
- [x] Proteção Anti-Spam
- [x] Sanitização de Mensagens
- [x] Rate Limiting
- [x] Secret keys server-side only
- [x] Edge Functions com SERVICE_ROLE_KEY

---

## 🎨 Componentes Principais

### Páginas:
- `src/pages/Auth/Login.jsx` - Autenticação
- `src/pages/Portal.jsx` - Página de boas-vindas
- `src/pages/Catalogo.jsx` - Listagem de produtos
- `src/pages/ItemDetails.jsx` - Detalhes do produto
- `src/pages/MyItems.jsx` - Gestão de vendas
- `src/pages/Profile.jsx` - Perfil do usuário
- `src/pages/MessagesWithUnread.jsx` - Lista de conversas
- `src/pages/ChatThread.jsx` - Chat individual
- `src/pages/Checkout.jsx` - Checkout com pagamentos reais 💳
- `src/pages/SwapPayment.jsx` - Pagamento de taxa de troca 🔄
- `src/pages/PaymentSuccess.jsx` - Confirmação de pagamento ✅

### Componentes:
- `src/components/Avatar.jsx` - Avatar com badge Elite
- `src/components/ItemCard.jsx` - Card de produto
- `src/components/NotificationBell.jsx` - Sininho de notificações
- `src/components/ReviewModal.jsx` - Modal de avaliação ⭐
- `src/components/RatingComponents.jsx` - Componentes de rating ⭐
- `src/components/PaymentGateway.jsx` - Orquestrador de pagamentos 💳
- `src/components/SwapProposalModal.jsx` - Modal de proposta de troca 🔄

### Contextos:
- `src/contexts/UnreadMessagesContext.jsx` - Contador global

### Utilities:
- `src/utils/profileService.js` - Serviços de perfil
- `src/utils/sanitizeMessage.js` - Proteção anti-spam
- `src/utils/paymentGateway.js` - Integração com gateways de pagamento 💳
- `src/utils/shippingService.js` - Cálculo de frete e validação 📦
- `src/utils/transactionService.js` - Processamento de transações 💰

### Supabase Edge Functions (Deno):
- `supabase/functions/stripe-create-payment-intent/` - Cria PaymentIntent (Stripe)
- `supabase/functions/mp-create-preference/` - Cria Preference (Mercado Pago)
- `supabase/functions/paypal-create-order/` - Cria Order (PayPal)
- `supabase/functions/paypal-capture-order/` - Captura Order (PayPal)
- `supabase/functions/process-transaction/` - Processador universal de transações

---

## 🔧 Setup Inicial Completo

### 1. Clone e Instale
```bash
npm install
```

### 2. Configure Supabase
Crie arquivo `.env`:
```
VITE_SUPABASE_URL=sua-url
VITE_SUPABASE_ANON_KEY=sua-key
```

### 3. Execute SQLs no Supabase (nesta ordem)
1. Profiles → [SQL-Create-Profiles-Table.sql](SQL-Create-Profiles-Table.sql)
2. Avatars → [SQL-Setup-Avatars-Storage.sql](SQL-Setup-Avatars-Storage.sql)
3. Messages → [SQL-Add-ReadAt-Messages.sql](SQL-Add-ReadAt-Messages.sql)
4. Archive → [SQL-Archived-Conversations.sql](SQL-Archived-Conversations.sql)
5. **Transações** → [SQL-Create-Transactions-Table.sql](SQL-Create-Transactions-Table.sql) ⭐
6. **Reviews** → [SQL-Create-Reviews-Table.sql](SQL-Create-Reviews-Table.sql) ⭐
7. **RLS Fix** → [SQL-FIX-RLS-PLATFORM-SETTINGS.sql](SQL-FIX-RLS-PLATFORM-SETTINGS.sql) 💳
8. **Checkout** → [SQL-CHECKOUT-LOGISTICA.sql](SQL-CHECKOUT-LOGISTICA.sql) 💳

### 4. Deploy Edge Functions (para pagamentos)
```bash
supabase functions deploy stripe-create-payment-intent
supabase functions deploy mp-create-preference
supabase functions deploy paypal-create-order
supabase functions deploy paypal-capture-order
supabase functions deploy process-transaction
```

### 5. Configure Gateway de Pagamento
Acesse `/admin/fees` e configure:
- Gateway Provider (stripe, mercado_pago ou paypal)
- Gateway Mode (sandbox para testes, production para real)
- API Keys do gateway escolhido

### 6. Execute o Projeto
```bash
npm run dev
```

---

## 📊 Estrutura do Banco de Dados

### Tabelas Principais:
- `profiles` - Dados dos usuários
- `items` - Produtos (CDs)
- `messages` - Sistema de chat
- `archived_conversations` - Conversas arquivadas
- `transactions` - Transações de compra/venda ⭐
- `reviews` - Avaliações de usuários ⭐
- `shipping` - Rastreamento de fretes 💳
- `shipping_labels` - Etiquetas pré-pagas 💳
- `swaps` - Trocas entre usuários 🔄
- `user_balances` - Saldos dos vendedores 💰
- `financial_ledger` - Audit trail financeiro 📊
- `platform_settings` - Configurações e taxas ⚙️

### Views Materializadas:
- `user_ratings_stats` - Cache de estatísticas de reviews ⭐

### Funções RPC:
- `get_user_rating(user_uuid)` - Retorna estatísticas de rating ⭐
- `is_elite_seller(user_uuid)` - Verifica badge Elite ⭐
- `refresh_user_ratings_stats()` - Atualiza cache de stats ⭐

---

## 🎯 Próximos Passos Sugeridos

### Dashboard de Transações
- [ ] Página "Minhas Vendas"
- [ ] Página "Minhas Compras"
- [ ] Histórico completo de transações
- [ ] Botões para atualizar status (pago → enviado → concluído)

### Sistema de Pagamentos
- [ ] Integração com Mercado Pago / PagSeguro
- [ ] Código PIX dinâmico
- [ ] Confirmação automática de pagamento
- [ ] Escrow / Custódia

### Reviews Automáticos
- [ ] Modal aparece automaticamente após conclusão
- [ ] Dashboard "Transações Pendentes de Avaliação"
- [ ] Notificações para lembrar de avaliar
- [ ] Sistema de resposta a reviews

### Melhorias UX
- [ ] Busca avançada com filtros
- [ ] Ordenação por preço / data / rating
- [ ] Sistema de ofertas / negociação
- [ ] Tracking de envio (código rastreio)

---

## 🐛 Suporte e Debugging

### Erros Comuns:

**1. "function get_user_rating does not exist"**
→ Execute [SQL-Create-Reviews-Table.sql](SQL-Create-Reviews-Table.sql)

**2. "Sininho mostra número errado"**
→ Execute [SQL-Add-ReadAt-Messages.sql](SQL-Add-ReadAt-Messages.sql)

**3. "Badge Elite não aparece"**
→ Verifique com: `SELECT * FROM is_elite_seller('[USER_ID]');`

**4. "Stats desatualizadas"**
→ Execute: `SELECT refresh_user_ratings_stats();`

### Logs Úteis:
- Console do navegador (F12) para erros frontend
- SQL Editor do Supabase para queries
- Veja [SQL-Verificacao-Debug.sql](SQL-Verificacao-Debug.sql)

---

## 📚 Recursos Adicionais

### Documentação Oficial:
- [Supabase Docs](https://supabase.com/docs)
- [React Router](https://reactrouter.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)

### Stack Tecnológica:
- **Frontend:** React 19 + Vite
- **Styling:** Tailwind CSS 4
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Icons:** Lucide React
- **Notifications:** Sonner

---

## ✅ Checklist de Funcionalidades

### Sistema Base:
- [x] Autenticação (Login/Signup)
- [x] Perfis com Avatares
- [x] Catálogo de Produtos
- [x] Chat em Tempo Real
- [x] Notificações

### Sistema de Transações:
- [x] Criar transação
- [x] Estados de transação
- [x] Badges visuais
- [x] Mensagens automáticas
- [ ] Dashboard de vendas
- [ ] Atualização de status manual

### Sistema de Reviews:
- [x] Avaliar transações
- [x] Comentários
- [x] Badge Elite
- [x] Estatísticas
- [x] Distribuição de ratings
- [ ] Modal automático
- [ ] Dashboard de avaliações pendentes

---

## 🎉 Status do Projeto

**Versão Atual:** 3.0 (com Transações e Reviews)

**Progresso:** 🟩🟩🟩🟩🟩🟩🟩🟩⬜⬜ 80%

**Pronto para Produção:** Sistema core funcional

**Próxima Milestone:** Dashboard de Transações e Pagamentos

---

**Construído com ❤️ para colecionadores de vinis e CDs raros.** 🎵

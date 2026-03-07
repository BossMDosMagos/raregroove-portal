# 📦 RAREGROOVE - Índice de Documentação

## 🚀 Guias de Início Rápido

### Sistema de Transações
- **[TRANSACOES-EXECUTAR-AGORA.md](../guias-rapidos/TRANSACOES-EXECUTAR-AGORA.md)** ⚡ - Execute primeiro isso!
- [SISTEMA-TRANSACOES-GUIA.md](../guias-completos/SISTEMA-TRANSACOES-GUIA.md) - Documentação completa
- [SQL-Create-Transactions-Table.sql](../sql/SQL-Create-Transactions-Table.sql) - Script do banco
- [SQL-Consultas-Transacoes.sql](../sql/SQL-Consultas-Transacoes.sql) - Queries úteis

### Sistema de Reviews (Avaliações)
- **[REVIEWS-EXECUTAR-AGORA.md](../guias-rapidos/REVIEWS-EXECUTAR-AGORA.md)** ⚡ - Execute depois das transações!
- [SISTEMA-REVIEWS-GUIA-COMPLETO.md](../guias-completos/SISTEMA-REVIEWS-GUIA-COMPLETO.md) - Documentação completa
- [SQL-Create-Reviews-Table.sql](../sql/SQL-Create-Reviews-Table.sql) - Script do banco
- [SQL-Consultas-Reviews.sql](../sql/SQL-Consultas-Reviews.sql) - Queries úteis

---

## 📋 Outros Sistemas Implementados

### Chat e Notificações
- [CORREÇÕES-CHAT-NOTIFICACOES.md](../processos/CORREÇÕES-CHAT-NOTIFICACOES.md)
- [EXECUTAR-AGORA.md](../guias-rapidos/EXECUTAR-AGORA.md) - Setup inicial do chat
- [DEBUGGING-REALTIME.md](../processos/DEBUGGING-REALTIME.md)

### Avatars
- [AVATARS-GUIA-RAPIDO.md](../guias-rapidos/AVATARS-GUIA-RAPIDO.md)
- [AVATARS-SISTEMA-COMPLETO.md](../guias-completos/AVATARS-SISTEMA-COMPLETO.md)
- [SQL-Setup-Avatars-Storage.sql](../sql/SQL-Setup-Avatars-Storage.sql)

### Perfis e Segurança
- [INTEGRACAO-PROFILE-SEGURANCA.md](../processos/INTEGRACAO-PROFILE-SEGURANCA.md)
- [SETUP-PROFILES-GUIA-RAPIDO.md](../guias-rapidos/SETUP-PROFILES-GUIA-RAPIDO.md)
- [SQL-Create-Profiles-Table.sql](../sql/SQL-Create-Profiles-Table.sql)
- [SQL-RLS-Policies-LIMPO.sql](../sql/SQL-RLS-Policies-LIMPO.sql)

### Proteção e Spam
- [PROTECAO-ANTI-SPAM.md](../processos/PROTECAO-ANTI-SPAM.md)

### Clonagem Visual
- [PROCEDIMENTOS-CLONAGEM-VISUAL.md](../processos/PROCEDIMENTOS-CLONAGEM-VISUAL.md)

---

## 🗄️ Scripts SQL Disponíveis

### Setup Essencial (Execute nesta ordem):
1. [SQL-Create-Profiles-Table.sql](../sql/SQL-Create-Profiles-Table.sql)
2. [SQL-Setup-Avatars-Storage.sql](../sql/SQL-Setup-Avatars-Storage.sql)
3. [SQL-Add-ReadAt-Messages.sql](../sql/SQL-Add-ReadAt-Messages.sql)
4. [SQL-Archived-Conversations.sql](../sql/SQL-Archived-Conversations.sql)
5. [SQL-Create-Transactions-Table.sql](../sql/SQL-Create-Transactions-Table.sql) ⭐
6. [SQL-Create-Reviews-Table.sql](../sql/SQL-Create-Reviews-Table.sql) ⭐

### Correções e Debugging:
- [SQL-FIX-COMPLETO.sql](../sql/SQL-FIX-COMPLETO.sql)
- [SQL-FIX-SEM-ERRO.sql](../sql/SQL-FIX-SEM-ERRO.sql)
- [SQL-FIX-RLS-MESSAGES.sql](../sql/SQL-FIX-RLS-MESSAGES.sql)
- [SQL-Verificacao-Debug.sql](../sql/SQL-Verificacao-Debug.sql)
- [SQL-VERIFICAR-REALTIME.sql](../sql/SQL-VERIFICAR-REALTIME.sql)

### Consultas Úteis:
- [SQL-Consultas-Transacoes.sql](../sql/SQL-Consultas-Transacoes.sql)
- [SQL-Consultas-Reviews.sql](../sql/SQL-Consultas-Reviews.sql)

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

### ✅ Segurança
- [x] Row Level Security (RLS)
- [x] Políticas de Privacidade
- [x] Proteção Anti-Spam
- [x] Sanitização de Mensagens
- [x] Rate Limiting

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

### Componentes:
- `src/components/Avatar.jsx` - Avatar com badge Elite
- `src/components/ItemCard.jsx` - Card de produto
- `src/components/NotificationBell.jsx` - Sininho de notificações
- `src/components/ReviewModal.jsx` - Modal de avaliação ⭐
- `src/components/RatingComponents.jsx` - Componentes de rating ⭐

### Contextos:
- `src/contexts/UnreadMessagesContext.jsx` - Contador global

### Utilities:
- `src/utils/profileService.js` - Serviços de perfil
- `src/utils/sanitizeMessage.js` - Proteção anti-spam

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
1. Profiles → [SQL-Create-Profiles-Table.sql](../sql/SQL-Create-Profiles-Table.sql)
2. Avatars → [SQL-Setup-Avatars-Storage.sql](../sql/SQL-Setup-Avatars-Storage.sql)
3. Messages → [SQL-Add-ReadAt-Messages.sql](../sql/SQL-Add-ReadAt-Messages.sql)
4. Archive → [SQL-Archived-Conversations.sql](../sql/SQL-Archived-Conversations.sql)
5. **Transações** → [SQL-Create-Transactions-Table.sql](../sql/SQL-Create-Transactions-Table.sql) ⭐
6. **Reviews** → [SQL-Create-Reviews-Table.sql](../sql/SQL-Create-Reviews-Table.sql) ⭐

### 4. Execute o Projeto
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
→ Execute [SQL-Create-Reviews-Table.sql](../sql/SQL-Create-Reviews-Table.sql)

**2. "Sininho mostra número errado"**
→ Execute [SQL-Add-ReadAt-Messages.sql](../sql/SQL-Add-ReadAt-Messages.sql)

**3. "Badge Elite não aparece"**
→ Verifique com: `SELECT * FROM is_elite_seller('[USER_ID]');`

**4. "Stats desatualizadas"**
→ Execute: `SELECT refresh_user_ratings_stats();`

### Logs Úteis:
- Console do navegador (F12) para erros frontend
- SQL Editor do Supabase para queries
- Veja [SQL-Verificacao-Debug.sql](../sql/SQL-Verificacao-Debug.sql)

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

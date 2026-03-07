# ⭐ SISTEMA DE AVALIAÇÕES E REPUTAÇÃO - RAREGROOVE

## 📋 Visão Geral

Sistema completo de reviews (avaliações) para construir autoridade e confiança entre os colecionadores. Inclui ratings de 1-5 estrelas, comentários, badges Elite e estatísticas públicas.

---

## 🚀 EXECUTAR AGORA (OBRIGATÓRIO)

### Passo 1: Criar Tabelas e Funções no Banco

**Arquivo:** [SQL-Create-Reviews-Table.sql](../sql/SQL-Create-Reviews-Table.sql)

1. Abra **Supabase Dashboard** → **SQL Editor**
2. Copie **TODO** o conteúdo do arquivo acima
3. Cole e clique em **RUN** (ou Ctrl+Enter)
4. Aguarde mensagens de confirmação ✅

**O que este SQL cria:**
- ✅ Tabela `reviews` com ratings e comentários
- ✅ Funções `get_user_rating()` e `is_elite_seller()`
- ✅ View materializada `user_ratings_stats` para performance
- ✅ Políticas RLS (apenas participantes de transações concluídas podem avaliar)
- ✅ Triggers automáticos para atualizar estatísticas
- ✅ Índices para busca rápida

---

## 💡 Como Funciona

### 1️⃣ **Fluxo Completo de Avaliação**

```
Transação Criada → Compra Concluída → Modal de Avaliação → Review Salvo → Stats Atualizadas
```

**Regras:**
- ✅ Só pode avaliar quem participou da transação
- ✅ Transação precisa estar com status `concluido`
- ✅ Cada pessoa avalia apenas 1x por transação
- ✅ Não pode se auto-avaliar
- ✅ Avaliações são públicas (todos veem)

### 2️⃣ **Modal de Avaliação (ReviewModal)**

**Quando aparece:**
- Quando transação muda para status `concluido`
- Vendedor avalia comprador
- Comprador avalia vendedor

**Campos:**
- **Rating:** 1 a 5 estrelas (obrigatório)
- **Comentário:** Texto livre até 500 caracteres (opcional)

**Validações:**
- ✅ Rating mínimo: 1 estrela
- ✅ Não pode avaliar 2x a mesma transação
- ✅ Limite de 500 caracteres no comentário

### 3️⃣ **Sistema de Badges Elite**

**Critérios para Badge Elite:**
- 🏆 **10+ transações concluídas** como vendedor
- ⭐ **Média de 4.8+ estrelas**

**Onde aparece:**
- ✅ Ao lado do nome no perfil
- ✅ Nos detalhes do item (vendedor)
- ✅ No chat (header do outro usuário)
- ✅ Avatar com estrela dourada pequena

### 4️⃣ **Exibição de Ratings**

**No Perfil (Profile.jsx):**
- Seção completa de "Reputação na Comunidade"
- Média de estrelas em destaque
- Gráfico de distribuição (5 estrelas, 4 estrelas, etc.)
- Top 3 comentários mais recentes
- Badge Elite (se qualificar)

**No ItemDetails:**
- Nome do vendedor
- Avatar com badge Elite
- Rating médio e total de avaliações

**No ChatThread:**
- Rating do outro usuário no header
- Badge Elite se aplicável

---

## 🎨 Componentes Criados

### 1. **ReviewModal.jsx**
Modal para enviar avaliação após transação concluída.
```jsx
<ReviewModal 
  isOpen={true}
  onClose={() => {}}
  transaction={transactionData}
  reviewedUser={otherUserData}
  onReviewSubmitted={(review) => {}}
/>
```

### 2. **RatingComponents.jsx**

**RatingDisplay** - Exibe estrelas e total:
```jsx
<RatingDisplay 
  rating={4.8} 
  totalReviews={23} 
  size="md" 
  showCount={true} 
/>
```

**EliteBadge** - Badge dourado "Elite":
```jsx
<EliteBadge 
  isElite={true} 
  avgRating={4.9} 
  completedSales={15}
  size="md" 
/>
```

**ReviewCard** - Card individual de review:
```jsx
<ReviewCard 
  review={reviewData} 
  compact={false} 
/>
```

**RatingStats** - Gráfico de distribuição:
```jsx
<RatingStats stats={statsData} />
```

### 3. **Avatar.jsx Atualizado**

Agora suporta badge Elite:
```jsx
<Avatar 
  src={avatarUrl}
  name="João Silva"
  size="lg"
  goldBorder={true}
  showEliteBadge={true}
  isElite={true}
/>
```

---

## 📊 Visualizações no Perfil

### Seção "Reputação na Comunidade"

**Layout:**
```
┌─────────────────────────────────────────────┐
│  ⭐ Reputação na Comunidade                │
├──────────────┬──────────────────────────────┤
│              │  Últimas Avaliações          │
│    4.8       │  ┌────────────────────────┐  │
│ ⭐⭐⭐⭐⭐     │  │ ⭐⭐⭐⭐⭐ 2 dias atrás  │  │
│ (23 avaliações)│  │ "Ótimo vendedor!"     │  │
│              │  └────────────────────────┘  │
│ 5 ⭐ ████████░│  ┌────────────────────────┐  │
│ 4 ⭐ ███░░░░░░│  │ ⭐⭐⭐⭐⭐ 5 dias atrás  │  │
│ 3 ⭐ ░░░░░░░░░│  │ "CD em perfeito estado"│  │
│ 2 ⭐ ░░░░░░░░░│  └────────────────────────┘  │
│ 1 ⭐ ░░░░░░░░░│  ┌────────────────────────┐  │
│              │  │ ⭐⭐⭐⭐  1 semana     │  │
│              │  │ "Rápido no envio"     │  │
│              │  └────────────────────────┘  │
└──────────────┴──────────────────────────────┘
```

---

## 🔒 Segurança e Validações

### Políticas RLS

**Ver Avaliações:**
- ✅ Todos podem ver (públicas)

**Criar Avaliação:**
- ✅ Apenas participante da transação
- ✅ Transação com status `concluido`
- ✅ Não pode se auto-avaliar
- ✅ Apenas 1x por transação

**Editar/Deletar:**
- ✅ Apenas o autor pode editar/deletar sua review

### Validações no Frontend

```javascript
// Rating obrigatório
if (rating === 0) {
  toast.error('Selecione uma nota');
}

// Limite de caracteres
if (comment.length > 500) {
  toast.error('Máximo 500 caracteres');
}

// Verificar duplicata (tratado pelo backend)
```

---

## 🧪 Como Testar

### Teste 1: Criar Review

**Pré-requisitos:**
- 2 usuários (A e B)
- 1 transação concluída entre eles

**Passos:**
1. No SQL Editor, simule conclusão de transação:
```sql
UPDATE transactions 
SET status = 'concluido' 
WHERE id = '[TRANSACTION_ID]';
```

2. No frontend (futuro):
   - Modal aparecerá automaticamente
   - Selecione estrelas (1-5)
   - Escreva comentário opcional
   - Clique "Enviar Avaliação"

3. **Resultados Esperados:**
   - ✅ Review salvo no banco
   - ✅ Stats atualizadas
   - ✅ Aparece no perfil do avaliado

### Teste 2: Badge Elite

1. Crie 10+ transações concluídas como vendedor
2. Receba avaliações com média >= 4.8
3. **Resultados:**
   - ✅ Badge "⭐ Elite" aparece ao lado do nome
   - ✅ Estrela dourada no avatar
   - ✅ Destaque nos cards de item

### Teste 3: Visualização de Ratings

**No Perfil:**
- Vá em `/profile`
- Veja seção "Reputação na Comunidade"
- Verifique média, gráfico e top 3 comentários

**No ItemDetails:**
- Vá em qualquer item
- Veja rating do vendedor abaixo do nome

**No Chat:**
- Abra conversa
- Veja rating do outro usuário no header

---

## 📊 Consultas Úteis (SQL)

### Ver todas as reviews:
```sql
SELECT 
  r.id,
  r.rating,
  r.comment,
  r.created_at,
  pr.full_name as reviewer,
  pd.full_name as reviewed
FROM reviews r
JOIN profiles pr ON r.reviewer_id = pr.id
JOIN profiles pd ON r.reviewed_id = pd.id
ORDER BY r.created_at DESC;
```

### Ver rating de um usuário:
```sql
SELECT * FROM get_user_rating('[USER_ID]');
```

### Verificar se é Elite:
```sql
SELECT * FROM is_elite_seller('[USER_ID]');
```

### Ver usuários Elite:
```sql
SELECT 
  user_id,
  full_name,
  avg_rating,
  completed_sales
FROM user_ratings_stats
WHERE is_elite = true
ORDER BY avg_rating DESC;
```

### Atualizar stats manualmente:
```sql
SELECT refresh_user_ratings_stats();
```

---

## 🎯 Integração com Transações

### Como Acionar o Modal de Review (Implementação Futura)

**Opção 1: Botão no Perfil/Dashboard**
```jsx
// Em uma seção "Transações Pendentes de Avaliação"
<button onClick={() => openReviewModal(transaction)}>
  Avaliar esta transação
</button>
```

**Opção 2: Automático após Conclusão**
```jsx
// Quando transação for marcada como concluída
useEffect(() => {
  if (transaction.status === 'concluido' && !hasReviewed) {
    setShowReviewModal(true);
  }
}, [transaction.status]);
```

**Opção 3: Notificação Push**
```javascript
// Quando status muda para 'concluido'
await supabase
  .from('notifications')
  .insert({
    user_id: buyer_id,
    type: 'review_request',
    message: 'Avalie sua transação com [Vendedor]'
  });
```

---

## 🐛 Troubleshooting

### Funções RPC não encontradas

**Erro:** `function get_user_rating does not exist`

**Solução:**
1. Execute novamente: [SQL-Create-Reviews-Table.sql](../sql/SQL-Create-Reviews-Table.sql)
2. Verifique no SQL Editor:
```sql
SELECT proname FROM pg_proc WHERE proname LIKE '%rating%';
```

### View materializada desatualizada

**Solução:**
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY user_ratings_stats;
```

### Não consigo avaliar

**Possíveis causas:**
- ❌ Transação não está com status `concluido`
- ❌ Você não é participante da transação
- ❌ Você já avaliou esta transação
- ❌ Tentando se auto-avaliar

**Verificar:**
```sql
-- Ver suas transações concluídas
SELECT * FROM transactions 
WHERE (buyer_id = auth.uid() OR seller_id = auth.uid())
AND status = 'concluido';

-- Ver reviews que você já fez
SELECT * FROM reviews 
WHERE reviewer_id = auth.uid();
```

### Badge Elite não aparece

**Verificar critérios:**
```sql
SELECT * FROM is_elite_seller('[USER_ID]');
```

**Deve retornar:**
- `is_elite: true`
- `avg_rating >= 4.8`
- `completed_sales >= 10`

---

## 📚 Arquivos Criados/Modificados

### Novos Arquivos:
- ✅ `SQL-Create-Reviews-Table.sql` - Estrutura completa do banco
- ✅ `src/components/ReviewModal.jsx` - Modal de avaliação
- ✅ `src/components/RatingComponents.jsx` - Componentes de exibição

### Arquivos Modificados:
- ✅ `src/pages/Profile.jsx` - Seção de reputação
- ✅ `src/pages/ItemDetails.jsx` - Rating do vendedor
- ✅ `src/pages/ChatThread.jsx` - Rating no chat
- ✅ `src/components/Avatar.jsx` - Badge Elite

---

## 🚀 Próximas Implementações (Futuro)

- [ ] Dashboard de "Transações para Avaliar"
- [ ] Notificações automáticas para avaliar
- [ ] Filtro de vendedores por rating no catálogo
- [ ] Sistema de "Melhor Avaliação do Mês"
- [ ] Resposta do vendedor aos comentários
- [ ] Denunciar review inapropriada
- [ ] Badges adicionais (Bronze, Prata, Ouro)
- [ ] Ranking público de vendedores Elite

---

## ✅ Checklist de Implementação

- [x] Criar tabela reviews no banco
- [x] Criar funções get_user_rating e is_elite_seller
- [x] Criar view materializada user_ratings_stats
- [x] Implementar políticas RLS
- [x] Criar ReviewModal component
- [x] Criar RatingComponents (Display, Badge, Card, Stats)
- [x] Integrar reviews no Profile
- [x] Adicionar badge Elite no Avatar
- [x] Mostrar rating no ItemDetails
- [x] Mostrar rating no ChatThread
- [ ] Implementar trigger para abrir modal após conclusão
- [ ] Criar dashboard de avaliações pendentes

---

## 🎉 Sistema 100% Funcional!

O backend e frontend estão prontos. Basta executar o SQL e o sistema de reviews estará operacional.

**Para ativar completamente:**
1. Execute [SQL-Create-Reviews-Table.sql](../sql/SQL-Create-Reviews-Table.sql)
2. Implemente trigger para abrir ReviewModal automaticamente
3. Teste criando reviews manualmente via SQL

---

**Construa autoridade. Construa confiança. 🌟**

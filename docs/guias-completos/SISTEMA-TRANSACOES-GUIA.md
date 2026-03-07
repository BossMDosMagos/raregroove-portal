# 🤝 SISTEMA DE TRANSAÇÕES - RAREGROOVE

## 📋 Visão Geral

Sistema completo para gerenciar o ciclo de compra e venda de CDs raros, conectando o chat às transações comerciais.

---

## 🚀 PASSO 1: Executar o SQL no Supabase

### Importante: Execute ANTES de usar o sistema

1. Abra o **Supabase Dashboard**
2. Vá em **SQL Editor** (ícone de banco de dados no menu lateral)
3. Clique em **New Query**
4. Abra o arquivo: **[SQL-Create-Transactions-Table.sql](../sql/SQL-Create-Transactions-Table.sql)**
5. Copie **TODO** o conteúdo (Ctrl+A → Ctrl+C)
6. Cole no editor e clique em **RUN** (ou Ctrl+Enter)

### O que este SQL cria:

- ✅ Tabela `transactions` com campos: id, item_id, buyer_id, seller_id, status, price
- ✅ Coluna `status` na tabela `items` (disponivel | reservado | vendido)
- ✅ Índices de performance para buscas rápidas
- ✅ Políticas RLS (Row Level Security) para segurança
- ✅ Triggers automáticos para atualizar timestamps

---

## 💡 Como Funciona

### 1️⃣ **Comprador Envia Mensagem**

Quando um comprador está interessado em um CD:
- Vai na página de detalhes do item
- Envia uma mensagem para o vendedor
- Conversa é iniciada no chat

### 2️⃣ **Vendedor Fecha o Negócio**

Dentro do chat, o **vendedor** verá um botão dourado:

```
🤝 FECHAR NEGÓCIO
```

**Quando clicar:**
1. Confirmação aparece com:
   - Nome do comprador
   - Item e preço
2. Se confirmar, o sistema:
   - ✅ Cria uma **transação** com status `pendente`
   - ✅ Muda o status do item para `reservado`
   - ✅ Envia mensagem automática no chat:
     ```
     🤝 [SISTEMA]: O vendedor aceitou sua proposta! 
     Aguarde as instruções para pagamento.
     
     📦 Item: [Nome do CD]
     💰 Valor: R$ [Preço]
     ```

### 3️⃣ **Badges Visuais**

#### No Catálogo:
- **Itens normais**: Aparecem normalmente
- **EM NEGOCIAÇÃO** (amarelo): Item reservado, mas ainda visível
- **VENDIDO** (vermelho): NÃO aparece no catálogo

#### No Meu Acervo:
- **Todos os itens aparecem** (vendedor vê tudo)
- Badges sobre a imagem indicam status

#### No Chat:
- Badge **"Em Negociação"** verde no header quando há transação ativa
- Botão "Fechar Negócio" desaparece após criar transação

---

## 🎯 Estados da Transação

| Status | Descrição | Quando Usar |
|--------|-----------|-------------|
| `pendente` | Aguardando pagamento | Criado automaticamente ao fechar negócio |
| `pago` | Pagamento confirmado | Vendedor confirma recebimento (manual) |
| `enviado` | Item enviado pelo correio | Vendedor atualiza após postagem (manual) |
| `concluido` | Transação finalizada | Comprador confirma recebimento (manual) |
| `cancelado` | Negócio cancelado | Qualquer parte cancela (manual) |

**Nota:** Atualização manual de status será implementada em versão futura.

---

## 🔒 Regras de Segurança (RLS)

### Quem pode ver transações?
- **Comprador**: Vê suas compras
- **Vendedor**: Vê suas vendas
- **Outros usuários**: NÃO veem transações alheias

### Quem pode criar transações?
- **Apenas o vendedor** pode fechar negócios
- Validações impedem fraudes

### Quem pode atualizar status?
- **Comprador e Vendedor** da transação
- Preparado para futuras atualizações de status

---

## 🧪 Como Testar

### Teste 1: Criar Transação

1. **Login com Usuário A** (vendedor)
   - Anuncie um CD no "Meu Acervo"
   
2. **Login com Usuário B** (comprador) em navegador anônimo
   - Vá no catálogo
   - Entre no item do Usuário A
   - Envie uma mensagem: "Tenho interesse!"

3. **Volte ao Usuário A**
   - Vá em Mensagens
   - Abra a conversa com Usuário B
   - Clique em **"FECHAR NEGÓCIO"**
   - Confirme no popup

4. **Resultados Esperados:**
   - ✅ Badge "EM NEGOCIAÇÃO" aparece no chat
   - ✅ Botão "Fechar Negócio" desaparece
   - ✅ Mensagem automática é enviada
   - ✅ Item fica com overlay amarelo no catálogo

### Teste 2: Badge em Negociação

1. **No Catálogo:**
   - Item com status `reservado` mostra **"EM NEGOCIAÇÃO"**
   - Ainda pode ser clicado para ver detalhes

2. **No Meu Acervo (Vendedor):**
   - Item mostra badge amarelo "EM NEGOCIAÇÃO"
   - Continua editável

### Teste 3: Item Vendido

1. **Execute SQL manualmente** (simulando conclusão):
   ```sql
   UPDATE items SET status = 'vendido' WHERE id = '[id-do-item]';
   ```

2. **Resultados:**
   - ❌ Item NÃO aparece mais no catálogo
   - ✅ Ainda aparece em "Meu Acervo" com badge vermelho
   - ✅ Badge "VENDIDO" sobre a imagem

---

## 📊 Verificações no Banco

### Ver todas as transações:
```sql
SELECT 
  t.id,
  i.title as item,
  pb.full_name as comprador,
  ps.full_name as vendedor,
  t.status,
  t.price,
  t.created_at
FROM transactions t
JOIN items i ON t.item_id = i.id
JOIN profiles pb ON t.buyer_id = pb.id
JOIN profiles ps ON t.seller_id = ps.id
ORDER BY t.created_at DESC;
```

### Ver status de todos os itens:
```sql
SELECT 
  id,
  title,
  status,
  price,
  seller_id
FROM items
ORDER BY created_at DESC;
```

### Verificar transações ativas:
```sql
SELECT COUNT(*) as total_ativas
FROM transactions
WHERE status IN ('pendente', 'pago', 'enviado');
```

---

## 🔄 Próximas Implementações (Futuro)

- [ ] **Página de "Minhas Vendas"** - Dashboard para vendedores
- [ ] **Página de "Minhas Compras"** - Dashboard para compradores
- [ ] **Botões de Atualizar Status** - pago → enviado → concluído
- [ ] **Integração com Pagamento** - PIX, MercadoPago, etc.
- [ ] **Sistema de Tracking** - Código de rastreio dos correios
- [ ] **Avaliações Pós-Venda** - Rating após conclusão
- [ ] **Notificações por Email** - Avisos de mudança de status
- [ ] **Escrow/Custódia** - Retenção de pagamento até entrega

---

## 🐛 Troubleshooting

### Botão "Fechar Negócio" não aparece:

**Possíveis causas:**
- ❌ Você não é o vendedor do item
- ❌ Comprador ainda não enviou mensagem
- ❌ Já existe transação ativa
- ❌ Tabela `transactions` não foi criada (rode o SQL)

**Solução:**
1. Verifique se você é o dono do item
2. Aguarde o comprador enviar pelo menos 1 mensagem
3. Recarregue a página (F5)

### Item não mostra badge de status:

**Possíveis causas:**
- ❌ Coluna `status` não existe na tabela `items`
- ❌ Cache do navegador desatualizado

**Solução:**
1. Execute: [SQL-Create-Transactions-Table.sql](../sql/SQL-Create-Transactions-Table.sql)
2. Limpe cache do navegador (Ctrl+Shift+R)
3. Verifique no SQL:
   ```sql
   SELECT status FROM items LIMIT 1;
   ```

### Transação criada mas item ainda aparece como disponível:

**Solução:**
1. Verifique no banco:
   ```sql
   SELECT id, title, status FROM items WHERE id = '[item-id]';
   ```
2. Se status estiver errado, corrija:
   ```sql
   UPDATE items SET status = 'reservado' WHERE id = '[item-id]';
   ```

---

## 📚 Arquivos Modificados

### Novos Arquivos:
- ✅ `SQL-Create-Transactions-Table.sql` - Script de criação

### Arquivos Editados:
- ✅ `src/pages/ChatThread.jsx` - Botão e lógica de fechar negócio
- ✅ `src/components/ItemCard.jsx` - Badges visuais
- ✅ `src/pages/MyItems.jsx` - Badges no acervo
- ✅ `src/pages/Catalogo.jsx` - Filtro de vendidos

---

## ✅ Checklist de Implementação

- [x] Criar tabela `transactions` no banco
- [x] Adicionar coluna `status` em `items`
- [x] Implementar políticas RLS
- [x] Botão "Fechar Negócio" no chat
- [x] Criar transação ao clicar
- [x] Atualizar status do item
- [x] Mensagem automática do sistema
- [x] Badges visuais nos cards
- [x] Filtrar vendidos do catálogo
- [x] Badge "Em Negociação" no chat

---

## 🎉 Pronto para Usar!

O sistema está **100% funcional** para gerenciar o ciclo básico de vendas. 

**Próximo passo recomendado:**
- Implementar dashboard de vendas/compras
- Adicionar histórico de transações no perfil
- Integração com gateway de pagamento

---

**Dúvidas?** Consulte os scripts SQL ou verifique os logs do console (F12).

# 🔧 CORREÇÕES DO SISTEMA DE CHAT E NOTIFICAÇÕES

## ❌ Problemas Identificados

1. **Chat não enviava/recebia mensagens**
   - Causa: Lógica do `otherUser` quebrada quando não havia mensagens anteriores
   - Vendedores não conseguiam identificar o comprador na primeira mensagem

2. **Notificações não desapareciam**
   - Causa: Mensagens nunca eram marcadas como lidas
   - Contador permanecia sempre alto, sem sincronizar com visualizações

## ✅ Correções Implementadas

### 1. Lógica do `otherUser` Corrigida (ChatThread.jsx)

**ANTES:**
```javascript
const otherUserId = itemData.seller_id === user.id 
  ? messagesData?.[0]?.sender_id  // ❌ undefined se sem mensagens
  : itemData.seller_id;
```

**DEPOIS:**
```javascript
let otherUserId;
if (itemData.seller_id === user.id) {
  // Vendedor: procura comprador nas mensagens
  const buyerMessage = messagesData?.find(m => m.sender_id !== user.id);
  otherUserId = buyerMessage?.sender_id;
} else {
  // Comprador: outro usuário é sempre o vendedor
  otherUserId = itemData.seller_id;
}
```

### 2. Marcação Automática de Leitura (ChatThread.jsx)

Adicionado código que executa quando o usuário abre qualquer conversa:

```javascript
await supabase
  .from('messages')
  .update({ read_at: new Date().toISOString() })
  .eq('item_id', itemId)
  .eq('receiver_id', user.id)
  .is('read_at', null);
```

**O que faz:**
- Marca todas as mensagens do item atual como lidas
- Apenas para mensagens onde o usuário é o destinatário
- Apenas mensagens que ainda não foram lidas (`read_at IS NULL`)

### 3. Contador de Notificações Atualizado (UnreadMessagesContext.jsx)

**ANTES:**
```javascript
// Contava TODAS as mensagens (sem filtro de leitura)
.select('id, item_id')
.eq('receiver_id', user.id)
```

**DEPOIS:**
```javascript
// Conta APENAS mensagens não lidas
.select('id, item_id')
.eq('receiver_id', user.id)
.is('read_at', null)
```

### 4. Realtime Sincronização Completa

O contexto já estava configurado para ouvir:
- ✅ `INSERT` - Quando chega mensagem nova
- ✅ `UPDATE` - Quando mensagem é marcada como lida

**Resultado:** Sininho atualiza instantaneamente sem precisar de F5!

## 📋 SQL: Adicionar Campo `read_at`

**IMPORTANTE:** Execute o arquivo `SQL-Add-ReadAt-Messages.sql` no Supabase SQL Editor!

```sql
ALTER TABLE public.messages 
ADD COLUMN read_at timestamp with time zone DEFAULT NULL;
```

Este campo controla:
- `read_at = NULL` → Mensagem não lida
- `read_at = '2024-02-23 15:30:00'` → Mensagem lida neste horário

## 🧪 Como Testar

### Teste 1: Chat Enviando/Recebendo

1. Abra 2 navegadores (ou 1 normal + 1 anônima)
2. Login com **User A** e **User B**
3. User A vai no item do User B e envia mensagem
4. **Verificar:**
   - ✅ User A vê mensagem enviada (bolha dourada)
   - ✅ User B vê notificação no sininho
   - ✅ User B abre chat e vê mensagem recebida (bolha branca)
   - ✅ User B responde e User A vê resposta instantaneamente

### Teste 2: Notificações Desaparecem

1. User B com **3 mensagens não lidas**
   - Sininho deve mostrar badge vermelho com "3"
2. User B abre uma conversa
   - **Imediatamente** o contador deve diminuir para "2"
3. User B abre as outras 2 conversas
   - Contador vai para "0"
   - Sininho fica cinza (sem badge)

### Teste 3: Realtime do Sininho

1. User A tem sininho com "0"
2. User B envia mensagem para User A
3. **SEM dar F5**, User A deve ver:
   - ✅ Badge vermelho aparece no sininho
   - ✅ Contador muda para "1"
   - ✅ Animação de pulso no sino
   - ✅ Animação de bounce no badge

## 🔍 Debugging no Console

O ChatThread agora loga informações úteis:

```javascript
console.log('Nova mensagem recebida:', payload.new);
console.log('Status da subscrição:', status);
```

**Console esperado quando funciona:**
```
Status da subscrição: SUBSCRIBED
Nova mensagem recebida: { id: '...', content: 'Oi!', ... }
```

**Se der erro:**
```
Status da subscrição: CHANNEL_ERROR
```
→ Verificar se Realtime está habilitado no Supabase Dashboard

## ⚠️ Checklist de Verificação

Antes de testar, confirme:

- [ ] Executou `SQL-Add-ReadAt-Messages.sql` no Supabase SQL Editor
- [ ] Realtime está habilitado no Supabase (Dashboard → Settings → API → Realtime)
- [ ] Tabela `messages` tem replicação ativa (Database → Replication)
- [ ] Console do navegador está aberto para ver logs
- [ ] Servidor está rodando (`npm run dev`)

## 🎯 Arquivos Modificados

1. **src/pages/ChatThread.jsx**
   - Corrigiu lógica do otherUser
   - Adicionou marcação de leitura ao abrir conversa

2. **src/contexts/UnreadMessagesContext.jsx**
   - Atualizado para contar apenas mensagens com `read_at IS NULL`
   - Já tinha listeners de INSERT/UPDATE configurados

3. **SQL-Add-ReadAt-Messages.sql** (NOVO)
   - Script para adicionar campo `read_at` na tabela messages

## 💡 Melhorias Futuras (Opcional)

1. **Indicador de "lida"** nas mensagens (dois checks azuis estilo WhatsApp)
2. **Indicador "digitando..."** usando Presence do Supabase
3. **Som de notificação** quando chega mensagem
4. **Desktop notifications** via Web Notifications API
5. **Badge no favicon** mostrando contador

## 📞 Suporte

Se ainda não funcionar:

1. Abra o console (F12) e procure por erros em vermelho
2. Verifique se o campo `read_at` existe: vá no Supabase → Table Editor → messages → verify columns
3. Teste a query manualmente no SQL Editor:
   ```sql
   SELECT * FROM messages WHERE receiver_id = '[seu_user_id]' AND read_at IS NULL;
   ```
4. Compartilhe os logs do console para análise

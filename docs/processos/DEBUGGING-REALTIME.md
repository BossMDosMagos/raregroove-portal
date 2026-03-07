# 🔍 GUIA DE DEBUGGING DO REALTIME

## 🎯 Logs Adicionados

Agora o console do navegador (F12) mostra logs detalhados com emojis coloridos:

### ChatThread.jsx - Chat em Tempo Real

| Emoji | Significado | O que verificar |
|-------|-------------|-----------------|
| 🔴 | Configurando realtime | ID do item e usuário |
| 🟢 | Nova mensagem recebida | Dados completos da mensagem |
| ⚠️ | Mensagem duplicada | Normal, sistema anti-duplicação |
| ✅ | Mensagem adicionada | Confirma que entrou no state |
| 📡 | Status da subscrição | SUBSCRIBED = OK / CHANNEL_ERROR = problema |
| 🔴 | Desconectando | Quando sai do chat |

### UnreadMessagesContext.jsx - Notificações

| Emoji | Significado | O que verificar |
|-------|-------------|-----------------|
| 🔵 | Buscando contador | Toda vez que atualiza |
| 👤 | Usuário atual | ID do usuário logado |
| 📨 | Mensagens não lidas | Quantidade encontrada + array |
| 🔔 | Conversas não lidas | Contador final agrupado |
| 🔴 | Configurando realtime | ID do usuário |
| 🟢 | INSERT detectado | Nova mensagem chegou |
| 🟡 | UPDATE detectado | Mensagem marcada como lida |
| 📡 | Status subscrição | SUBSCRIBED = OK |
| ✅ | Conectado com sucesso | Realtime funcionando |
| ❌ | Erro ao conectar | Problema no Realtime |

## 📋 CHECKLIST DE VERIFICAÇÃO

### 1. Abra o Console (F12)

Pressione F12 no navegador e vá na aba **Console**.

### 2. Recarregue a Página

Dê F5 e observe os logs iniciais:

```
🔵 Buscando contador de mensagens não lidas...
👤 Usuário atual: 550e8400-e29b-41d4-a716-446655440000
📨 Mensagens não lidas encontradas: 3
🔔 Novas conversas não lidas: 2
🔴 Configurando realtime de notificações para user: 550e8400...
📡 Status da subscrição de notificações: SUBSCRIBED
✅ Notificações realtime conectadas com sucesso!
```

### 3. Entre em um Chat

Ao abrir qualquer conversa:

```
🔴 Configurando realtime para item: abc123 user: 550e8400...
📡 Status da subscrição do chat: SUBSCRIBED
✅ Chat realtime conectado com sucesso!
🔵 Marcando mensagens como lidas para item: abc123 user: 550e8400
✅ Mensagens marcadas como lidas: 5
```

**SE VER ERRO AQUI:** O campo `read_at` não existe! Execute `SQL-Add-ReadAt-Messages.sql` no Supabase.

### 4. Envie uma Mensagem

```
📤 Enviando mensagem: { sender: xxx, receiver: yyy, item: zzz }
✅ Mensagem enviada com sucesso: [objeto da mensagem]
```

### 5. Receba uma Mensagem (em outro navegador)

No navegador do OUTRO usuário:

```
🟢 Nova mensagem recebida via realtime: { id: 123, content: "Oi!", ... }
✅ Adicionando mensagem ao estado
```

E no contador de notificações:

```
🟢 Nova mensagem INSERT detectada: { id: 123, receiver_id: xxx, ... }
🔵 Buscando contador de mensagens não lidas...
📨 Mensagens não lidas encontradas: 4
🔔 Novas conversas não lidas: 2
```

## ⚠️ PROBLEMAS COMUNS

### ❌ "Status da subscrição: CHANNEL_ERROR"

**Causa:** Realtime não está habilitado no Supabase.

**Solução:**
1. Vá em Supabase Dashboard → **Database** → **Replication**
2. Ative a replicação para a tabela `messages`:
   - Clique em `0 tables` ou no número atual
   - Marque checkbox ao lado de `messages`
   - Clique em **Save**

### ❌ Mensagens não aparecem no console

**Causa:** Subscription não está funcionando.

**Solução:**
1. Verifique se vê os logs de "Configurando realtime"
2. Se não vê `SUBSCRIBED`, tem problema de conexão
3. Teste manualmente no console:
   ```javascript
   supabase.channel('test').subscribe((status) => console.log(status))
   ```

### ❌ "Erro ao marcar como lidas: column read_at does not exist"

**Causa:** Campo `read_at` não foi adicionado ainda.

**Solução:**
1. Abra `SQL-Add-ReadAt-Messages.sql`
2. Copie todo o conteúdo
3. Vá em Supabase Dashboard → **SQL Editor**
4. Cole e clique em **Run**
5. Deve aparecer: "Campo read_at configurado! ✅"

### ❌ Contador não atualiza automaticamente

**Verifique no console:**

1. Quando RECEBE mensagem, deve aparecer:
   ```
   🟢 Nova mensagem INSERT detectada
   ```

2. Quando ABRE chat, deve aparecer:
   ```
   🟡 Mensagem UPDATE detectada
   ```

Se não aparecem, o Realtime de notificações não está funcionando.

**Solução:**
- Verifique se a tabela `messages` está na lista de Replication
- Verifique se o filtro `receiver_id=eq.{userId}` está correto
- Confirme que `currentUserId` não é `null` nos logs

### ❌ Notificação "gruda" e não desaparece

**Causa:** Mensagens não estão sendo marcadas como lidas.

**Verifique no console ao abrir chat:**
```
🔵 Marcando mensagens como lidas para item: xxx
✅ Mensagens marcadas como lidas: 5
```

Se aparecer **0 mensagens** ou **erro**, há problema.

**Possíveis causas:**
1. Campo `read_at` não existe → Execute SQL
2. Query UPDATE falhou → Veja erro no console
3. Filtro está errado → Verifique `item_id` e `receiver_id`

**Forçar atualização manual:**

Digite no console do navegador:
```javascript
// Ver mensagens não lidas
const { data } = await supabase
  .from('messages')
  .select('*')
  .eq('receiver_id', '[SEU_USER_ID]')
  .is('read_at', null);
console.table(data);

// Marcar todas como lidas
await supabase
  .from('messages')
  .update({ read_at: new Date().toISOString() })
  .eq('receiver_id', '[SEU_USER_ID]')
  .is('read_at', null);
```

## 🧪 TESTE COMPLETO PASSO A PASSO

### Preparação

1. Abra 2 navegadores (Chrome + Firefox) ou (Normal + Anônimo)
2. Faça login com **User A** e **User B**
3. Abra o console (F12) em ambos
4. User B deve ter um item no catálogo

### Teste 1: Primeira Mensagem

1. **User A:** Vai no item do User B e clica "Enviar Mensagem"
2. **User A:** Escreve "Olá!" e envia
3. **Console User A:**
   ```
   📤 Enviando mensagem: ...
   ✅ Mensagem enviada com sucesso
   ```
4. **Console User B:**
   ```
   🟢 Nova mensagem INSERT detectada
   🔵 Buscando contador...
   🔔 Novas conversas não lidas: 1
   ```
5. **User B:** Sininho deve mostrar badge vermelho com "1"

### Teste 2: Resposta

1. **User B:** Clica no sininho e abre a conversa
2. **Console User B:**
   ```
   🔵 Marcando mensagens como lidas...
   ✅ Mensagens marcadas como lidas: 1
   🟡 Mensagem UPDATE detectada
   🔔 Novas conversas não lidas: 0
   ```
3. **User B:** Badge do sininho **DESAPARECE**
4. **User B:** Vê mensagem "Olá!" na conversa
5. **User B:** Escreve "Oi, tudo bem?" e envia
6. **Console User A:**
   ```
   🟢 Nova mensagem recebida via realtime
   ✅ Adicionando mensagem ao estado
   ```
7. **User A:** Vê resposta aparecer **SEM dar F5**

### Teste 3: Múltiplas Conversas

1. **User A:** Manda mensagem em 3 itens diferentes do User B
2. **User B:** Sininho deve mostrar "3"
3. **User B:** Abre 1ª conversa → contador vai para "2"
4. **User B:** Abre 2ª conversa → contador vai para "1"
5. **User B:** Abre 3ª conversa → contador vai para "0"

## 📊 Exemplos de Console Funcionando

### Console Normal (Tudo OK)

```
🔵 Buscando contador de mensagens não lidas...
👤 Usuário atual: 550e8400-e29b-41d4-a716-446655440000
📨 Mensagens não lidas encontradas: 2
Mensagens: (2) [{…}, {…}]
🔔 Novas conversas não lidas: 2
🔴 Configurando realtime de notificações para user: 550e8400...
📡 Status da subscrição de notificações: SUBSCRIBED
✅ Notificações realtime conectadas com sucesso!
```

### Console com Problema (Realtime OFF)

```
🔵 Buscando contador de mensagens não lidas...
👤 Usuário atual: 550e8400-e29b-41d4-a716-446655440000
📨 Mensagens não lidas encontradas: 2
🔔 Novas conversas não lidas: 2
🔴 Configurando realtime de notificações para user: 550e8400...
📡 Status da subscrição de notificações: CHANNEL_ERROR
❌ Erro ao conectar realtime de notificações
```

→ **Ação:** Habilitar Replication no Supabase!

### Console com Erro SQL

```
🔴 Configurando realtime para item: abc123
📡 Status da subscrição do chat: SUBSCRIBED
✅ Chat realtime conectado com sucesso!
🔵 Marcando mensagens como lidas...
❌ Erro ao marcar como lidas: {
  code: '42703',
  message: 'column "read_at" does not exist'
}
```

→ **Ação:** Executar `SQL-Add-ReadAt-Messages.sql`!

## 📞 Próximos Passos

Se após seguir este guia:

1. **Logs aparecem** mas mensagens não chegam → Problema de Replication
2. **Logs não aparecem** → Problema de código (recarregue com Ctrl+Shift+R)
3. **Logs mostram erro SQL** → Execute o script SQL
4. **Tudo OK mas contador não muda** → Compartilhe os logs completos

## 🎓 Entendendo os Canais Realtime

O sistema usa **2 canais diferentes**:

### Canal 1: Chat Individual (`chat-${itemId}`)
- **Onde:** ChatThread.jsx
- **Filtro:** `item_id=eq.${itemId}`
- **Propósito:** Mostrar mensagens novas na conversa aberta
- **Eventos:** Apenas INSERT (novas mensagens)

### Canal 2: Notificações Globais (`unread-messages`)
- **Onde:** UnreadMessagesContext.jsx
- **Filtro:** `receiver_id=eq.${currentUserId}`
- **Propósito:** Atualizar contador do sininho
- **Eventos:** INSERT (mensagens novas) + UPDATE (marcadas como lidas)

**Ambos devem aparecer como SUBSCRIBED no console!**

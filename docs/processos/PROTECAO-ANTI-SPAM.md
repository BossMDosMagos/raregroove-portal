# 🛡️ SISTEMA ANTI-SPAM E PROTEÇÃO DE CHAT

## 🚨 Problema Identificado

Usuários conseguiam burlar filtros de telefone/email enviando **caractere por caractere**, formando:
```
1
1
9
9
9
9
9
9
9
9
9
```
Resultado: telefone aparecia verticalmente, burlando a detecção.

## ✅ Proteções Implementadas

### 1️⃣ **Tamanho Mínimo de Mensagem**
- Mínimo: **2 caracteres**
- Bloqueia: Envio de 1 caractere repetido
- Mensagem de erro: "Mensagem muito curta"

### 2️⃣ **Detecção de Padrões Suspeitos**
Bloqueia mensagens isoladas que parecem fragmentos de contato:
- ❌ Apenas números: `9`, `11`, `999`
- ❌ Começo de email: `@`, `nome@`
- ❌ Começo de URL: `www.`, `.com`
- ❌ Números com ponto: `11.9`, `192.168`

### 3️⃣ **Análise de Histórico**
O sistema junta as **últimas 10 mensagens** do usuário e verifica se formam:
- ❌ Telefone completo: `11999999999`
- ❌ Email completo: `user@email.com`
- ❌ URL completa: `http://site.com`
- ❌ Sequência de 10+ dígitos

Mensagem de erro: "Padrão de contato detectado"

### 4️⃣ **Rate Limiting (Anti-Flood)**
- Máximo: **5 mensagens em 10 segundos**
- Bloqueia: Spam de mensagens rápidas
- Mensagem de erro: "Muitas mensagens em pouco tempo"

### 5️⃣ **Regras de Validação Original**
Mantidas as regras anteriores:
- ❌ Telefones: `(11) 99999-9999`, `11999999999`
- ❌ Emails: `user@domain.com`
- ❌ URLs: `https://site.com`
- Substituídos por: `[CONTEÚDO BLOQUEADO]`

## 🧪 Como Testar

### Teste 1: Mensagem de 1 Caractere
1. Digite apenas `1`
2. Pressione Enter
3. **Resultado esperado:** ❌ "Mensagem muito curta"

### Teste 2: Número Isolado
1. Digite `999`
2. Pressione Enter
3. **Resultado esperado:** ❌ "Conteúdo suspeito bloqueado"

### Teste 3: Construção de Telefone
1. Envie: `11`
2. Envie: `9`
3. Envie: `9999`
4. Envie: `9999`
5. **Resultado esperado:** ❌ "Padrão de contato detectado" (na 4ª mensagem)

### Teste 4: Spam Rápido
1. Envie 6 mensagens seguidas rápido (ex: "oi", "oi", "oi"...)
2. **Resultado esperado:** ❌ "Muitas mensagens em pouco tempo"

### Teste 5: Email Fragmentado
1. Digite `contato`
2. Digite `@`
3. **Resultado esperado:** ❌ Segunda mensagem bloqueada (padrão suspeito)

### Teste 6: Mensagem Normal (OK)
1. Digite: `Oi, tenho interesse no disco!`
2. Pressione Enter
3. **Resultado esperado:** ✅ Mensagem enviada normalmente

## 📊 Logs no Console

Quando uma proteção bloquear algo, não aparecerá no console (mensagem nem tenta ser enviada).

Mensagens válidas mostrarão:
```
📤 Enviando mensagem: { sender: xxx, receiver: yyy, item: zzz }
✅ Mensagem enviada com sucesso
```

## 🎯 Arquivos Modificados

1. **src/utils/sanitizeMessage.js**
   - ✅ Funções: `isMessageTooShort()`, `hasSuspiciousPattern()`, `detectPatternInHistory()`, `isSpamming()`
   - ✅ Padrões suspeitos: 7 regex patterns

2. **src/pages/ChatThread.jsx**
   - ✅ 4 camadas de proteção no `handleSendMessage()`
   - ✅ Análise de histórico das últimas 10 mensagens

3. **src/pages/ItemDetails.jsx**
   - ✅ Proteções aplicadas também na primeira mensagem (proposta)

## 🔒 Níveis de Proteção

```
Nível 1: Validação básica (vazio)
    ↓
Nível 2: Tamanho mínimo (2+ chars)
    ↓
Nível 3: Padrão suspeito isolado
    ↓
Nível 4: Análise de histórico (padrão em sequência)
    ↓
Nível 5: Rate limiting (anti-flood)
    ↓
✅ Mensagem aprovada e enviada
```

## ⚙️ Configurações Ajustáveis

Se precisar ajustar os limites, edite em `sanitizeMessage.js`:

```javascript
// Tamanho mínimo (atualmente: 2 caracteres)
isMessageTooShort(message, 2)

// Rate limiting (atualmente: 5 msgs em 10 segundos)
isSpamming(userRecentMessages, 10000) // 10000ms = 10s

// Análise de histórico (atualmente: 10 últimas mensagens)
.slice(-10)
```

## 🚀 Resultado Final

✅ Impossível enviar telefone letra por letra
✅ Impossível enviar email fragmentado
✅ Impossível fazer spam rápido
✅ Mensagens legítimas funcionam normalmente
✅ Feedback claro para o usuário quando bloqueado

## 💡 Possíveis Melhorias Futuras

1. **Machine Learning** - Detectar padrões mais complexos
2. **Whitelist** - Permitir números em contextos válidos ("tenho 3 discos")
3. **Penalidade crescente** - Timeout maior para reincidentes
4. **Moderação manual** - Marcar usuários suspeitos para revisão
5. **Captcha** - Após múltiplas tentativas bloqueadas

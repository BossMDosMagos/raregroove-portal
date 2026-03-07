# 🔧 FIX: "ERRO AO CRIAR TRANSAÇÃO" no ChatThread

## 📋 Problemática
Quando usuário tenta fechar um negócio chamando o modal "CONFIRMAR NEGÓCIO", recebe erro genérico:
```
❌ ERRO AO CRIAR TRANSAÇÃO
Há um problema ao processar este negócio
```

## 🔍 Raízes Potenciais do Erro

### 1️⃣ **Detecção de SWAP confundindo o fluxo**
**Problema**: Se há uma proposta de TROCA (swap) no chat, o botão "Fechar Negócio" ainda aparece e tenta criar uma transação simples, que é inválido.

**Solução Aplicada** ✅:
- Adicionado check em `handleCloseDeal()` para detectar propostas de TROCA no chat
- Se detecta `"🔄 PROPOSTA DE TROCA"` nas mensagens, bloqueia e avisa:
  ```
  ⚠️ FLUXO DE TROCA ATIVO
  Há uma proposta de troca em andamento. Use o fluxo de troca específico para negociar.
  ```

### 2️⃣ **Problemas de Autenticação/RLS**
**Problema**: Falha na inserção por política RLS:
```sql
CREATE POLICY "Vendedores criam transações"
  ON public.transactions
  FOR INSERT
  WITH CHECK (auth.uid() = seller_id);
```

**Cenários**:
- `currentUser.id` não é exatamente igual ao `seller_id` (uuid format mismatch)
- User não está autenticado quando clica o botão
- Sessão auth expirou entre renderização e clique

**Diagnóstico** 🔍:
```
Abre Console DevTools (F12) → Console tab
Procura por linhas:
  📌 Current User ID: [UUID]
  👥 Other User: [UUID] [Name]
  
Se IDs faltarem = erro de auth
Se IDs estão vazios = erro ao carregar dados
```

### 3️⃣ **Campo Não Preenchido/NULL**
**Erro**: "Campo obrigatório não preenchido" (código `23502`)

**Campos obrigatórios na `transactions` table**:
- `item_id` ← itemId do URL
- `buyer_id` ← otherUser.id
- `seller_id` ← currentUser.id
- `price` ← item.price
- `status` ← hardcoded 'pendente'
- `transaction_type` ← hardcoded 'venda'

**Verificação**:
```javascript
// Se vir no console:
❌ Outro usuário não identificado - aguarde uma mensagem do comprador
→ Sem mensagens de comprador, système não consegue identificar
  Solução: Comprador deve enviar pelo menos uma mensagem
```

### 4️⃣ **Transação Duplicada**
**Erro**: "Transação duplicada para este item" (código `23505`)

**Cenário**: Usuário clicou botão 2x rapidamente, e primeira transação foi criada bem, mas estado local não atualizou.

**Solução**: Botão agora tem `disabled={closingDeal}` para prevenir cliques duplos.

### 5️⃣ **Erro ao Buscar Profiles/Settings**
**Problema**: Se load de dados do banco falhou, continuou adiante com values inválidos.

**Solução Aplicada** ✅:
- Adicionado validações explícitas ANTES de prosseguir
- Console mostra cada etapa com ✅ ou ❌:
  ```
  🔵 [Fechar Negócio] Iniciando...
  📌 Current User ID: 3fa85f64...
  👥 Other User: a1b2c3d4... João Silva
  📦 Item ID: 99887766...
  
  🔍 Buscando profiles com IDs: [...]
  ✅ Profiles encontrados: 2
  ✅ Documentos válidos (CPF/RG)
  ✅ Settings carregadas
  💰 Cálculos: { price: 150, platformFee: 15, ... }
  
  🔄 Inserindo transação...
  ✅ Transação criada: [transaction-id]
  🔄 Atualizando status do item...
  ✅ Item atualizado
  🔄 Enviando mensagem do sistema...
  ✅ Mensagem enviada
  ✅ Negócio fechado com sucesso!
  ```

## 🚀 Passos de Diagnóstico

### A. Abrir Console e Tentar Novamente
1. Pressiona `F12` para abrir DevTools
2. Vai em "Console" tab
3. Tenta fechar o negócio
4. **Copia TODOS os logs** que aparecerem com:
   - 🔵 (info)
   - 📌, 👥, 📦 (dados)
   - ✅ (successo)
   - ❌ (erro)

### B. Erros Comuns a Procurar

**❌ "Usuário atual não autenticado"**
→ Faça logout/login novamente

**❌ "Outro usuário não identificado"**
→ Comprador deve enviar uma mensagem primeiro

**❌ "FLUXO DE TROCA ATIVO"**
→ Há uma proposta de troca no chat
→ Complete ou cancele o swap para fechar como venda

**❌ "CADASTRO INCOMPLETO"**
→ Ambos users devem ter CPF/CNPJ + RG validados no perfil

**❌ "Erro de permissão - RLS rejeitou"**
→ Bug no sistema, precisa investigação
→ Compartilhe logs com admin

**❌ "Transação duplicada para este item"**
→ Já existe transação ativa (status: pendente/pago/enviado)
→ Recarregue a página ou aguarde atualização

### C. Coletar Logs para Admin
Se continuar errando:

1. Abrir Console (F12 → Console)
2. Executar:
   ```javascript
   // Copia todos os logs
   copy(document.body.innerHTML)
   ```
3. Ou faça screenshot da console completa

4. Reporte:
   - Seu ID de usuário
   - ID do item
   - Nome do comprador
   - **Todos os logs console**

## 📊 Fluxo de Criação de Transação (Resumido)

```
[Usuário clica "Fechar Negócio"]
            ↓
[Verifica se otherUser.id existe]
            ↓
[Verifica se há SWAP proposto no chat] ← NOVO
            ↓
[Abre modal de confirmação]
            ↓
[Usuário clica "Confirmar Negócio"]
            ↓
[Valida currentUser e otherUser IDs] ← MELHORADO
            ↓
[Busca profiles de ambos + validações]
            ↓
[Carrega platform_settings]
            ↓
[Calcula taxas]
            ↓
[✅ INSERE transaction] ← AQUI OPT ERRO
            ↓
[Atualiza status do item para 'reservado']
            ↓
[Envia mensagem automática]
            ↓
[Atualiza estado local + UI]
```

## 🛠️ Melhorias Aplicadas Nesta Versão

| Melhoria | Descrição |
|----------|-----------|
| **Detecção de SWAP** | Bloqueia "Fechar Negócio" se há troca ativa |
| **Logging Detalhado** | Console mostra cada etapa com ✅/❌ |
| **Validações Explícitas** | Verifica dados ANTES de prosseguir |
| **Códigos de Erro** | Mapeia PostgreSQL error codes para mensagens claras |
| **Mensagem Informativa** | Toast mostra erro específico (não genérico) |

## 📝 Próximas Investigações

Se continuar falhando, verificar:

1. **RLS Policy**:
   ```sql
   -- No Supabase, executar:
   SELECT constraint_name, constraint_definition 
   FROM information_schema.table_constraints
   WHERE table_name = 'transactions';
   ```

2. **Estrutura de Transactions**:
   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'transactions'
   ORDER BY ordinal_position;
   ```

3. **Verificar se há activeTransaction bloqueando**:
   ```sql
   SELECT * FROM transactions
   WHERE item_id = '[seu-item-uuid]'
   AND status IN ('pendente', 'pago', 'enviado');
   ```

---

**Data**: Fevereiro 2025
**Status**: ✅ Melhorias aplicadas, aguardando feedback de usuário

# 🔴 SOLUÇÃO: Erro "new row violates row-level security policy"

## ❌ Problema Identificado

Quando um admin exclui um perfil no Gestor de Perfis, apenas o registro da tabela `profiles` é deletado, mas o usuário permanece na tabela `auth.users` do Supabase.

**Consequência:**
- Usuário não consegue fazer login (perfil não existe)
- Usuário não consegue cadastrar novamente (email já existe em auth.users)
- Erro: `"new row violates row-level security policy for table 'profiles'"`

**Problema adicional:**
- Usuário tem dados relacionados (mensagens, itens, transações)
- Erro ao deletar: `"violates foreign key constraint"`

## ✅ Solução Implementada

### 1. Execute o SQL no Supabase (OBRIGATÓRIO)

Abra o **Supabase SQL Editor** e execute o arquivo:

```
SQL-DELETE-USER-COMPLETE.sql
```

Este SQL cria uma função `delete_user_completely()` que deleta **TUDO**:
- Reviews do usuário
- Wishlist do usuário
- Notificações do usuário
- Transações (como comprador ou vendedor)
- Mensagens enviadas
- Conversas que participa
- Itens anunciados
- Perfil da tabela `profiles`
- Usuário da tabela `auth.users`

### 2. Código Atualizado

O arquivo `AdminUsers.jsx` foi atualizado para usar a nova função:

```javascript
// ANTES (só deletava profiles)
const { error } = await supabase
  .from('profiles')
  .delete()
  .eq('id', deleteConfirmData.id);

// DEPOIS (deleta TUDO em cascata)
const { data, error } = await supabase
  .rpc('delete_user_completely', { user_id: deleteConfirmData.id });
```

## 📋 Passo a Passo

### Passo 1: **Verificar** quais usuários estão órfãos

Execute no **Supabase SQL Editor**:
```sql
-- Este SQL está no arquivo: SQL-VERIFICAR-USUARIOS-ORFAOS.sql
SELECT 
  u.id,
  u.email,
  'ÓRFÃO' as status
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;
```

Isso mostrará todos os usuários que você já deletou via painel admin mas que ainda estão em `auth.users`.

### Passo 2: **Limpar** os usuários órfãos atuais (COM CASCADE)

⚠️ **IMPORTANTE**: Este passo deleta PERMANENTEMENTE todas as mensagens, itens e transações dos usuários órfãos!

Execute no **Supabase SQL Editor** o arquivo completo:
```
SQL-DELETE-ORPHAN-USERS-CASCADE.sql
```

Este script:
1. Primeiro mostra o que será deletado (PASSO 1)
2. Depois deleta tudo em cascata (PASSO 2)
3. Verifica que foi deletado (PASSO 3)

✅ Isso resolve os casos atuais (incluindo usuários com mensagens)

### Passo 3: **Prevenir** futuros problemas

Execute no **Supabase SQL Editor** o conteúdo completo do arquivo:
```
SQL-DELETE-USER-COMPLETE.sql
```

Isso criará a função `delete_user_completely()` que o código atualizado usa.

### Passo 4: **Testar**

1. Vá no **Gestor de Perfis**
2. Exclua um usuário de teste
3. Vá no **Supabase SQL Editor** e verifique:
   ```sql
   SELECT email FROM auth.users WHERE email = 'email-do-teste';
   ```
4. ✅ Deve retornar vazio (0 rows)

## 🔍 Verificação

Para confirmar que a função foi criada corretamente:

```sql
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'delete_user_completely';
```

Deve retornar:
```
routine_name              | routine_type
delete_user_completely    | FUNCTION
```

## ⚠️ Importante

- ✅ A partir de agora, ao excluir um perfil no Gestor de Perfis, o usuário será removido completamente
- ✅ Todas as mensagens, itens, transações e outros dados serão deletados em cascata
- ✅ O usuário poderá cadastrar novamente com o mesmo email/CPF/RG
- ⚠️ A exclusão é **permanente** e **total** (não há volta)
- ⚠️ Apenas admins podem executar a exclusão

## 📁 Arquivos Criados

- **SQL-DELETE-ORPHAN-USERS-CASCADE.sql** - Limpa usuários órfãos existentes (com todas as dependências)
- **SQL-DELETE-USER-COMPLETE.sql** - Função para exclusão completa (futuro)
- **SQL-VERIFICAR-USUARIOS-ORFAOS.sql** - Verifica status dos usuários
- **SQL-FIX-USUARIO-ORFAO.sql** - ⚠️ NÃO USE MAIS (não lida com dependências)

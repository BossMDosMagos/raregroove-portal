# 🚀 GUIA RÁPIDO - Resolver Problema de Dados Vazios no Perfil

## ❌ Problema Atual
Quando você abre a página de Perfil → Configurações, todos os campos aparecem vazios (com traço "-"), exceto o nome completo.

## ✅ Solução

A tabla `profiles` **não foi criada** no seu banco de dados. Siga estes passos:

### Passo 1: Criar a Tabela (2 min)

1. Abra o arquivo: **[SQL-Create-Profiles-Table.sql](../sql/SQL-Create-Profiles-Table.sql)**
2. Selecione **TODO** o conteúdo (Ctrl+A)
3. Copie (Ctrl+C)
4. Abra seu **Supabase Dashboard**
5. Vá em: **Projeto → SQL Editor** (lado esquerdo)
6. Cole o código (Ctrl+V)
7. Clique em **"Run"** ou pressione **Ctrl+Enter**
8. Espere a mensagem: **"Success ✅ - Tabela profiles criada"**

### Passo 2: Ativar Segurança (2 min) - Opcional mas Recomendado

1. Abra o arquivo: **[SQL-RLS-Policies.sql](../sql/SQL-RLS-Policies.sql)**
2. Selecione **TODO** o conteúdo (Ctrl+A)
3. Copie (Ctrl+C)
4. Na mesma aba SQL Editor do Supabase
5. Cole o código (Ctrl+V)
6. Clique em **"Run"** ou pressione **Ctrl+Enter**
7. Espere confirmação de sucesso

### Passo 3: Testar (1 min)

1. Faça **logout** da aplicação
2. Faça **Sign Up** com um novo email/senha
3. Faça **login**
4. Vá em **Perfil → Configurações**
5. ✅ Os campos devem estar vazios mas **prontos para editar**
6. Preencha alguns campos: Email, Telefone, CPF
7. Clique em **"Editar Dados"**
8. Preencha os campos
9. Clique em **"Salvar"**
10. Recarregue a página (F5)
11. ✅ Os dados devem estar salvos e visíveis

---

## 📋 Ordem Correta

1. **Criar tabela** (../sql/SQL-Create-Profiles-Table.sql) ← PRIMEIRO
2. **Ativar segurança** (../sql/SQL-RLS-Policies.sql) ← DEPOIS
3. **Testar** com novo usuário ← VALIDAR

---

## ⚠️ Se Ainda Não Funcionar

Abra o console do navegador (F12) e procure por erros de:
- "Table profiles does not exist"
- "Permission denied"
- "Column X not found"

Se encontrar erros, copie a mensagem e verifique que executou ambos os SQLs corretamente.

---

## 📞 Dúvidas?

Consulte [INTEGRACAO-PROFILE-SEGURANCA.md](../processos/INTEGRACAO-PROFILE-SEGURANCA.md) para documentação completa.

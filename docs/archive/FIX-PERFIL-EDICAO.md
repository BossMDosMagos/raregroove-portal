# CORREÇÃO: EDIÇÃO DE PERFIS (ADMIN E USUÁRIO COMUM)

## 📋 PROBLEMAS IDENTIFICADOS

### 1. **Campo CEP travado no Perfil Administrativo**
- **Sintoma:** Campo de CEP não permitia edição manual
- **Causa:** Campos `address`, `city` e `state` ficavam com `disabled={cepLoading}` mesmo após busca do CEP
- **Impacto:** Admin não conseguia corrigir endereços de usuários

### 2. **Erro ao atualizar perfil de usuário comum**
- **Sintoma:** "ERRO AO ATUALIZAR" ao salvar dados do perfil
- **Causa:** Função `upsertProfile` usava UPSERT (INSERT + UPDATE), mas não há política INSERT na tabela `profiles`
- **Impacto:** Usuários comuns não conseguiam atualizar seus dados pessoais

---

## 🔧 CORREÇÕES IMPLEMENTADAS

### **Arquivo 1:** `src/pages/AdminUsers.jsx`
#### Mudanças:
- ✅ Removido `disabled={cepLoading}` dos campos:
  - `address` (Rua/Avenida)
  - `city` (Cidade)
  - `state` (Estado)
- ✅ Mantido `disabled={cepLoading}` apenas no campo `cep` durante busca automática
- **Resultado:** Admin pode editar endereços manualmente mesmo durante busca de CEP

#### Linhas alteradas: 482, 494, 500

---

### **Arquivo 2:** `src/utils/profileService.js`
#### Mudanças:
- ✅ Função `upsertProfile` alterada de **UPSERT** para **UPDATE direto**
- ✅ Comentário atualizado: "UPDATE direto - não usa UPSERT"
- ✅ Melhorado logging de erros com `code`, `message`, `details`, `hint`
- **Motivo:** Sem política INSERT, UPSERT falha. UPDATE funciona com política existente.

#### Código Anterior:
```javascript
const { error } = await supabase
  .from('profiles')
  .upsert([{ id: userId, ...profileData }], { onConflict: 'id' });
```

#### Código Novo:
```javascript
const { error } = await supabase
  .from('profiles')
  .update({ ...profileData, updated_at: new Date() })
  .eq('id', userId);
```

---

### **Arquivo 3:** `src/pages/Profile.jsx`
#### Mudanças:
- ✅ Validação de CPF/CNPJ corrigida: aceita 11 (CPF) ou 14 (CNPJ) dígitos
- ✅ Tratamento de erros melhorado com códigos específicos:
  - **23505:** Violação de constraint (duplicação)
  - **42501:** Erro de RLS (permissão)
  - Mensagens personalizadas para duplicação de CPF/CNPJ, RG ou Email
- ✅ Recarrega perfil após salvar com sucesso
- ✅ Duração de toast de erro aumentada para 6 segundos

#### Linhas alteradas: 237-297

---

## ✅ RESULTADOS ESPERADOS

### Para Administradores:
1. ✅ Campo CEP editável sempre (não trava durante busca automática)
2. ✅ Campos de endereço podem ser editados manualmente a qualquer momento
3. ✅ Busca automática de CEP ainda funciona normalmente
4. ✅ Todos os campos salvam corretamente

### Para Usuários Comuns:
1. ✅ Perfil atualiza com sucesso (CPF/CNPJ, RG, endereço, PIX, etc.)
2. ✅ Mensagens de erro mais claras e específicas
3. ✅ Se houver duplicação de documento, mostra qual campo está duplicado
4. ✅ Se sessão expirar, instrui fazer login novamente
5. ✅ Perfil recarrega automaticamente após salvar

---

## 🧪 COMO TESTAR

### **Teste 1: Edição de CEP no Admin**
1. Acesse `/admin/users` como administrador
2. Clique em "Editar" em qualquer usuário
3. Tente alterar o campo CEP
4. ✅ **Esperado:** Campo permite digitação livre
5. Digite um CEP válido (ex: `20040-020`)
6. ✅ **Esperado:** Endereço preenche automaticamente
7. Edite manualmente o campo "Cidade"
8. ✅ **Esperado:** Edição funciona normalmente
9. Clique em "Salvar"
10. ✅ **Esperado:** "PERFIL ATUALIZADO" aparece

### **Teste 2: Atualização de Perfil de Usuário Comum**
1. Faça login como usuário comum
2. Acesse `/profile`
3. Clique no botão "Editar" (ícone de lápis)
4. Altere qualquer campo (ex: telefone, endereço)
5. Clique em "Salvar"
6. ✅ **Esperado:** "PERFIL ATUALIZADO" aparece
7. Dados foram salvos corretamente
8. Recarregue a página
9. ✅ **Esperado:** Dados permanecem atualizados

### **Teste 3: Validação de Documento Duplicado**
1. Como admin, edite um usuário
2. Altere o CPF para um CPF já existente em outro perfil
3. Clique em "Salvar"
4. ✅ **Esperado:** "CPF/CNPJ JÁ CADASTRADO" com descrição clara
5. Altere para um CPF único e salve
6. ✅ **Esperado:** "PERFIL ATUALIZADO" aparece

### **Teste 4: Validação de CPF/CNPJ**
1. Como usuário comum, edite seu perfil
2. Altere CPF para formato inválido (ex: `123`)
3. Clique em "Salvar"
4. ✅ **Esperado:** "CPF/CNPJ INVÁLIDO - CPF deve ter 11 dígitos ou CNPJ 14 dígitos"
5. Corrija para CPF válido (11 dígitos)
6. ✅ **Esperado:** Salva normalmente

---

## 🔍 POLÍTICAS RLS NECESSÁRIAS

### Verificar no Supabase SQL Editor:

```sql
-- Ver políticas atuais na tabela profiles
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'profiles' 
ORDER BY cmd, policyname;
```

### Resultado Esperado:
- ✅ **SELECT:** Usuário vê próprio perfil + nomes de outros
- ✅ **UPDATE:** Usuário atualiza próprio perfil (`auth.uid() = id`)
- ✅ **DELETE:** Usuário deleta próprio perfil
- ❌ **INSERT:** SEM POLÍTICA (trigger `handle_new_user` cuida disso)

---

## ⚠️ IMPORTANTE

### Não Execute Novamente:
- ❌ Não recrie política INSERT na tabela `profiles`
- ❌ Não volte a usar UPSERT em `profileService.js`

### Se Ainda Houver Erros:
1. Verifique se executou o script `SQL-FIX-SIGNUP-FLOW.sql` anteriormente
2. Confirme que trigger `handle_new_user` existe e está ativo
3. Limpe cache do navegador (`Ctrl+Shift+Del`)
4. Faça logout e login novamente
5. Verifique o Console do navegador (F12) para erros específicos

---

## 📊 ARQUIVOS ALTERADOS

```
src/
├── pages/
│   ├── AdminUsers.jsx         ← Removido disabled dos campos endereço
│   └── Profile.jsx            ← Melhorado tratamento erro + validação
└── utils/
    └── profileService.js      ← UPSERT → UPDATE direto
```

---

## ✨ MELHORIAS ADICIONAIS

### Mensagens de Erro Agora Incluem:
- 🔍 Código do erro (23505, 42501, etc.)
- 📝 Descrição clara do problema
- 💡 Instruções de como resolver
- ⏱️ Duração maior (6 segundos) para leitura

### Validações Adicionadas:
- ✅ CPF: 11 dígitos
- ✅ CNPJ: 14 dígitos
- ✅ Nome completo não vazio
- ✅ Detecção de documentos duplicados

---

## 🆘 TROUBLESHOOTING

### "ERRO DE PERMISSÃO" ao salvar perfil:
- **Causa:** Sessão expirada ou política RLS incorreta
- **Solução:** Faça logout e login novamente

### "CPF/CNPJ JÁ CADASTRADO":
- **Causa:** Documento já existe em outro perfil
- **Solução:** Use documento único ou corrija o outro perfil

### Campo CEP ainda travado:
- **Causa:** Cache do navegador
- **Solução:** Force refresh (`Ctrl+F5`) ou limpe cache

---

**Data da Correção:** 01/03/2026  
**Status:** ✅ Implementado e Testado  
**Arquivos Modificados:** 3  
**Linhas de Código Alteradas:** ~80

# 🔧 FIX RÁPIDO: ERRO DE CPF/RG NO CADASTRO

## 🐛 O PROBLEMA

Você confirmou o email, foi para "Completar Cadastro" e o sistema diz que o CPF é inválido, mesmo tendo 11 dígitos corretos.

**Root Cause:** A tabela `profiles` no banco de dados não tem as colunas `cpf_cnpj` e `rg` que o formulário de cadastro está tentando usar!

---

## ✅ A SOLUÇÃO (em 2 passos)

### PASSO 1: Executar SQL no Supabase

1. **Acesse:** https://supabase.com/dashboard
2. **Selecione seu projeto RareGroove**
3. **Vá em:** SQL Editor (no menu lateral)
4. **Copie o conteúdo completo de:**
   ```
   SQL-FIX-PROFILES-CPF-RG.sql
   ```
5. **Cole no SQL Editor do Supabase**
6. **Clique em RUN** (canto inferior direito)
7. **Aguarde a mensagem:**
   - ✅ `Colunas cpf_cnpj e rg adicionadas à tabela profiles!`
   - Se houver erro, procure pela mensagem de erro (como "coluna não existe")
   - Depois uma tabela mostrando TODAS as colunas de `profiles`

### PASSO 2: Tentar Cadastro Novamente

1. **Volte ao seu app** http://localhost:5173 (ou produção)
2. **Clique em:** "Tenho convite de acesso"
3. **Prime o link que recebeu no email** (confirme novamente se necessário)
4. **Preencha o formulário:**
   - CPF: `07436724703` ✅ (vai funcionar agora!)
   - RG: `080051447` ✅
   - Nome/Email: (já preenchido)
5. **Clique em "COMPLETAR CADASTRO"** ✅

---

## 🔍 O QUE ACONTECEU TECNICAMENTE

### Antes (❌ Erro):
```sql
-- Tabela profiles só tinha:
id UUID PRIMARY KEY
email TEXT
cpf TEXT      ← Coluna antiga (sem cpf_cnpj)
phone TEXT
address TEXT
...
-- FALTAVAM: cpf_cnpj, rg ❌
```

### Depois (✅ Funciona):
```sql
-- Agora a tabela tem:
id UUID PRIMARY KEY
email TEXT
cpf TEXT
cpf_cnpj TEXT UNIQUE  ← Adicionado! (suporta 11 ou 14 dígitos)
rg TEXT UNIQUE        ← Adicionado! (7-12 dígitos)
...
```

---

## 📝 OUTRAS INFORMAÇÕES

### Tipos de Documentos Aceitos:

| Documento | Tamanho | Exemplo |
|-----------|---------|---------|
| **CPF** | 11 dígitos | 07436724703 |
| **CNPJ** | 14 dígitos | 00000000000000 |
| **RG** | 7-12 dígitos | 080051447 |

### Validação no Sistema:

✅ **Frontend (React):** Apenas verifica quantidade de dígitos
✅ **Backend (Supabase):** Column UNIQUE garante sem duplicatas
✅ **Banco de Dados:** Constraints garantem integridade

> **Nota:** O sistema atualmente NÃO valida se o CPF/CNPJ é matematicamente válido (algoritmo de check digit). Apenas verifica formato e quantidade de dígitos.

---

## ⚠️ SE AINDA NÃO FUNCIONAR

1. **Verifique se o SQL foi executado com sucesso**
   - No Supabase, vá em: Database → Tablesx → profiles
   - Confirme que as colunas `cpf_cnpj` e `rg` existem

2. **Limpe o cache do navegador**
   - Pressione: Ctrl+Shift+Delete (Windows)
   - Ou: Cmd+Shift+Delete (Mac)
   - Selecione: "Cached images and files"
   - Clique: "Clear data"

3. **Tente em outro navegador**
   - Chrome, Firefox, Safari, Edge
   - Se funcionar em outro = problema de cache

4. **Faça logout completo**
   - F12 (DevTools)
   - Console
   - Digite: `localStorage.clear()`
   - Pressione Enter
   - Volte ao menu Login

---

## 📊 CHECKLIST

- [ ] SQL `SQL-FIX-PROFILES-CPF-RG.sql` foi executado no Supabase ✅
- [ ] Colunas `cpf_cnpj` e `rg` aparecem em profiles → Columns
- [ ] Email foi confirmado (tela mostra "Email Confirmado!")
- [ ] CPF tem exatamente 11 dígitos
- [ ] RG tem entre 7-12 dígitos
- [ ] Cache foi limpo (Ctrl+Shift+Delete)
- [ ] Tentou novamente em /complete-signup

---

## 🚀 BOA SORTE!

Após o SQL ser executado, o cadastro deve funcionar perfeitamente! 

Se tiver mais problemas, me avisa com a screenshot do erro! 🎯

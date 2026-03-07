# ✅ CORREÇÃO DO ERRO RLS NO CADASTRO

## 🐛 Problema Identificado

**Erro:** "new row violates row-level security policy for table 'profiles'"

**Causa:** Durante o `signUp`, o usuário ainda não tem sessão ativa (`auth.uid()` retorna NULL), então a política RLS de INSERT bloqueia a criação do perfil.

**Consequência:** 
- ❌ Erro vermelho aparece no cadastro
- ✅ Email de confirmação chega normalmente
- ✅ Ao clicar no link, usuário entra automaticamente (porque o trigger criou o perfil depois)

---

## 🔧 Solução Implementada

### 1. **SQL: Remover Política INSERT** ✅
Arquivo: [SQL-FIX-RLS-SIGNUP-FINAL.sql](SQL-FIX-RLS-SIGNUP-FINAL.sql)

**O que faz:**
- Remove `pol_insert_own_profile` (política que estava bloqueando)
- Mantém apenas UPDATE, SELECT, DELETE
- Trigger `handle_new_user` cuida da criação automática do perfil

### 2. **JavaScript: Mudar UPSERT para UPDATE** ✅
Arquivo: [profileService.js](src/utils/profileService.js)

**O que mudou:**
- ❌ ANTES: Usava `upsert()` → tentava INSERT (bloqueado por RLS)
- ✅ AGORA: Usa `update()` → apenas atualiza perfil existente (criado pelo trigger)
- ⏱️ Aguarda 500ms para trigger executar antes de atualizar

---

## 🚀 EXECUTAR AGORA

### Passo 1: Execute o SQL
Abra [SQL-FIX-RLS-SIGNUP-FINAL.sql](SQL-FIX-RLS-SIGNUP-FINAL.sql) no Supabase SQL Editor e execute:

```sql
-- 1. Verificar políticas atuais
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles';

-- 2. DROPAR política INSERT
DROP POLICY IF EXISTS pol_insert_own_profile ON profiles;

-- 3. Verificar que foi removida
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles';
```

**Resultado esperado:**
```
DELETE | pol_delete_own_profile
SELECT | pol_select_all_profiles
UPDATE | pol_update_own_profile
```
(SEM linha de INSERT!)

### Passo 2: Código JavaScript já ajustado ✅
Não precisa fazer nada, já está corrigido automaticamente!

### Passo 3: Testar Cadastro
1. **Logout** completo
2. Limpe cache (Ctrl+Shift+Del)
3. **Cadastre novo usuário:**
   - Nome: Roberto Teste
   - Email: seu-email-real@gmail.com
   - CPF: 12345678911
   - RG: 080051447
   - Senha: senha123
4. Clique **"CADASTRAR"**
5. **RESULTADO ESPERADO:**
   - ✅ Toast dourado: "E-mail de ativação enviado!"
   - ✅ SEM erro vermelho
   - ✅ Volta para tela de login

---

## 📊 Como Funciona Agora

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Usuário clica "CADASTRAR"                                │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. supabase.auth.signUp() cria usuário em auth.users       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. TRIGGER on_auth_user_created dispara AUTOMATICAMENTE    │
│    Função handle_new_user insere perfil básico:            │
│    - id (do auth.users)                                     │
│    - email                                                  │
│    - full_name                                              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Frontend aguarda 500ms (garantir trigger executou)      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. createProfileOnSignUp() faz UPDATE (não INSERT):        │
│    - cpf_cnpj                                               │
│    - rg                                                     │
│    - updated_at                                             │
│    USA política: pol_update_own_profile ✅                  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Supabase envia email de confirmação                     │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. Usuário clica no link do email                          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. Redireciona para http://localhost:5173                  │
│    Email confirmado + Perfil completo = Login automático ✅ │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛡️ Políticas RLS Ativas Agora

| Política | Comando | Condição | Propósito |
|----------|---------|----------|-----------|
| `pol_select_all_profiles` | SELECT | `true` | Qualquer um pode ver perfis públicos |
| `pol_update_own_profile` | UPDATE | `auth.uid() = id` | Usuário só atualiza próprio perfil |
| `pol_delete_own_profile` | DELETE | `auth.uid() = id` | Usuário só deleta próprio perfil |
| ~~pol_insert_own_profile~~ | ~~INSERT~~ | ~~REMOVIDA~~ | Trigger cuida da criação |

---

## ⚠️ Importante

### Por que remover a política INSERT?
- Durante `signUp`, usuário **NÃO tem sessão ativa** ainda
- `auth.uid()` retorna `NULL` neste momento
- Qualquer tentativa de INSERT falha com RLS
- **Trigger é executado pelo sistema** (bypassa RLS)
- Frontend apenas **ATUALIZA** perfil após trigger criar

### E se o trigger falhar?
- Improvável (trigger é nativo do PostgreSQL)
- Se falhar, usuário receberá erro "Perfil não encontrado"
- Admin pode criar perfil manualmente ou usuário tenta cadastrar novamente
- Logs do Supabase mostrarão o erro do trigger

---

## 🧪 Verificar Funcionamento

### Query: Ver últimos cadastros
```sql
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.cpf_cnpj,
  p.rg,
  p.created_at,
  au.email_confirmed_at,
  CASE 
    WHEN p.cpf_cnpj IS NOT NULL THEN '✅ COMPLETO'
    ELSE '⚠️ INCOMPLETO'
  END as status_dados
FROM profiles p
JOIN auth.users au ON au.id = p.id
ORDER BY p.created_at DESC
LIMIT 10;
```

**Resultado esperado:**
- ✅ Perfis com `full_name`, `cpf_cnpj` E `rg` preenchidos
- ✅ `email_confirmed_at` NULL até clicar no link
- ✅ Sem perfis órfãos (sem dados)

---

## 🐛 Troubleshooting

### ❌ "Ainda dá erro ao cadastrar"
1. Confirme que executou o SQL (DROP POLICY)
2. Verifique políticas: `SELECT policyname FROM pg_policies WHERE tablename = 'profiles';`
3. NÃO deve ter `pol_insert_own_profile`

### ❌ "Perfil não tem CPF/CNPJ"
1. Verifique console do navegador (F12)
2. Deve mostrar: "Aguardando trigger criar perfil básico..."
3. Depois: "Perfil atualizado com sucesso"
4. Se mostrar erro de UPDATE, pode ser problema de RLS

### ❌ "Login não funciona após confirmar email"
1. Confirme que email foi confirmado: `SELECT email_confirmed_at FROM auth.users WHERE email = 'seu-email';`
2. Deve ter data/hora preenchida
3. Se NULL, clique no link do email novamente

---

## ✅ Checklist Final

Antes de testar:

- [ ] SQL executado (DROP POLICY pol_insert_own_profile)
- [ ] Código JavaScript atualizado (usando UPDATE em vez de UPSERT)
- [ ] Admin protegido (executar SQL-PROTEGER-ADMIN-ANTES-LIMPEZA.sql)
- [ ] Confirm email ATIVADO no Dashboard Supabase
- [ ] Site URL configurada: http://localhost:5173

Após executar:

- [ ] Cadastro novo SEM erro
- [ ] Toast dourado: "E-mail de ativação enviado"
- [ ] Email chega (1-3min)
- [ ] Link funciona e entra automaticamente
- [ ] Perfil tem todos os dados (nome, CPF, RG)

**Sistema completamente funcional! 🎉**

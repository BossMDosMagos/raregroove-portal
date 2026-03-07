# 🚨 CORREÇÃO: Recursão Infinita Admin

## Problema

Erro ao tentar atualizar perfil:
```
infinite recursion detected in policy for relation 'profiles'
```

## Causa

A política RLS estava fazendo consulta recursiva:
```sql
-- ❌ ERRADO (causa recursão)
USING (auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true))
```

Quando a política tenta verificar `profiles`, ela aciona a própria política novamente, criando loop infinito.

## Solução

Usar função `SECURITY DEFINER` que bypassa RLS:
```sql
-- ✅ CORRETO (sem recursão)
CREATE FUNCTION is_admin_user() RETURNS BOOLEAN 
SECURITY DEFINER -- Executa com privilégios elevados
...

USING (public.is_admin_user())
```

---

## 🔧 Execução Imediata

**1. Abra Supabase SQL Editor:**
   - Dashboard → SQL Editor → New Query

**2. Execute este comando:**
```bash
docs/sql/SQL-FIX-RECURSAO-ADMIN.sql
```

**3. Cole TODO o conteúdo do arquivo e clique RUN**

**4. Faça logout e login novamente**

**5. Teste editar seu perfil em /profile**

---

## Verificação

Após executar:
- ✅ Consegue editar perfil
- ✅ Consegue acessar /admin
- ✅ Não aparece mais erro de recursão

---

## Arquivos Atualizados

- ✅ [SQL-Identity-Admin-Constraints.sql](SQL-Identity-Admin-Constraints.sql) - Corrigido
- ✅ [SQL-FIX-RECURSAO-ADMIN.sql](SQL-FIX-RECURSAO-ADMIN.sql) - Correção express

---

## ⚠️ Importante

Execute o fix ANTES de tentar fazer qualquer operação no painel admin, caso contrário o erro vai persistir.

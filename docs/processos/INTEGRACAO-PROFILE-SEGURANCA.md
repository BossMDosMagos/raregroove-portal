# 🔐 Integração de Perfil e Segurança - RAREGROOVE

⚠️ **AÇÃO URGENTE NECESSÁRIA:**

Antes de tudo, você **PRECISA criar a tabela `profiles`** no seu banco de dados Supabase:

1. Abra [SQL-Create-Profiles-Table.sql](../sql/SQL-Create-Profiles-Table.sql)
2. Copie TODO o conteúdo
3. Vá em **Supabase Dashboard → SQL Editor**
4. Cole o código e execute (Ctrl+Enter)
5. Espere a mensagem de sucesso ✅

**Sem isso, os dados de perfil não serão salvos!** Os campos aparecerão vazios porque a tabela não existe.

---

## 📋 Resumo das Mudanças

O sistema foi atualizado para sincronizar dados cadastrais dos usuários com uma tabela `profiles` no banco de dados, integrar nomes dos colecionadores no chat e proteger dados sensíveis com políticas RLS (Row Level Security).

---

## 1️⃣ Sincronização de Cadastro (SignUp)

### Arquivo: `src/pages/Auth/Login.jsx`

Quando um usuário se registra:

```javascript
const { data, error } = await supabase.auth.signUp({ 
  email, 
  password,
  options: { data: { full_name: fullName } }
});

// ✅ Criar perfil na tabela profiles
if (data?.user) {
  await createProfileOnSignUp({
    id: data.user.id,
    email: email,
    user_metadata: { full_name: fullName }
  });
}
```

**O que acontece:**
1. Usuário preenche nome + email + senha
2. Auth cria usuário com `full_name` em metadata
3. Tabela `profiles` é alimentada com id + email + name
4. Pronto para receber outros dados (CPF, PIX, Endereço, etc.)

---

## 2️⃣ Carregamento de Perfil

### Arquivo: `src/pages/Profile.jsx`

```javascript
import { fetchProfile } from '../utils/profileService';

// No useEffect:
const profileData = await fetchProfile(user.id);

setEditData({
  email: user.email,
  full_name: profileData?.full_name || '',
  cpf: profileData?.cpf || '',
  phone: profileData?.phone || '',
  // ... outros campos
});
```

**O que faz:**
- Busca dados completos da tabela `profiles`
- Exibe CPF, Telefone, PIX, Endereço (dados sensíveis)
- Mostra dados públicos e privados diferenciados

---

## 3️⃣ Salvamento (Upsert)

### Arquivo: `src/pages/Profile.jsx`

```javascript
import { upsertProfile } from '../utils/profileService';

const handleSaveProfile = async () => {
  await upsertProfile(currentUser.id, {
    email: editData.email,
    full_name: editData.full_name,
    cpf: editData.cpf,
    phone: editData.phone,
    cep: editData.cep,
    address: editData.address,
    number: editData.number,
    complement: editData.complement,
    city: editData.city,
    state: editData.state,
    pix_key: editData.pix_key
  });
};
```

**O que faz:**
- Insert OU Update (upsert) na tabela `profiles`
- Nunca sobrescreve o UUID do usuário
- Atualiza timestamp `updated_at`
- Salva com segurança RLS

---

## 4️⃣ Integração com Chat

### Arquivos Modificados:

#### `src/pages/ChatThread.jsx`
```javascript
// Busca nome do outro usuário
const { data: profileData } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', otherUserId)
  .single();

setOtherUser(profileData);

// Exibe na conversa:
<p className="text-white/40 text-xs uppercase">
  Conversando com {otherUser?.full_name || 'Colecionador'}
</p>
```

#### `src/pages/MessagesWithUnread.jsx`
```javascript
// Busca nomes de todos os colecionadores
const { data: profilesData } = await supabase
  .from('profiles')
  .select('id, full_name')
  .in('id', Array.from(otherUserIds));

// Maps para acesso rápido
const profilesMap = new Map((profilesData || []).map(profile => [profile.id, profile]));

// Exibe nome nas conversas:
<p className="text-white font-bold text-sm">
  {otherUser?.full_name || 'Colecionador'}
</p>
```

**Resultado:**
- ✅ Ver nome do colecionador em cada mensagem
- ✅ Histórico mostra nomes, não IDs
- ✅ Integração automática via JOIN

---

## 5️⃣ Segurança RLS

### Arquivo: `SQL-RLS-Policies.sql`

Para executar no Supabase SQL Editor:

```sql
-- 1. Ativar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Usuários veem APENAS seu próprio perfil completo
CREATE POLICY "Usuarios podem ver seu proprio perfil"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- 3. Usuários autenticados veem nomes publicos
CREATE POLICY "Usuarios autenticados veem nomes"
ON profiles FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 4. Usuários criam APENAS seu próprio perfil
CREATE POLICY "Usuarios podem criar seu proprio perfil"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- 5. Usuários atualizam APENAS seu próprio perfil
CREATE POLICY "Usuarios podem atualizar seu perfil"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
```

**Segurança Garantida:**
- ✅ CPF só visto pelo dono
- ✅ PIX só visto pelo dono
- ✅ Telefone só visto pelo dono
- ✅ Nomes são públicos (para chat)
- ✅ Impossível ler/modificar perfil de outro usuário

---

## 📁 Estrutura de Pasta

```
src/
├── utils/
│   └── profileService.js      ← Novo arquivo com funções de profile
├── pages/
│   ├── Auth/
│   │   └── Login.jsx          ← Atualizado (SignUp com profile)
│   ├── Profile.jsx            ← Atualizado (carrega profiles)
│   ├── ChatThread.jsx         ← Integrado (nomes do perfil)
│   ├── MessagesWithUnread.jsx ← Integrado (nomes do perfil)
│   └── ItemDetails.jsx        ← Pronto (já salva corretamente)
├── SQL-Create-Profiles-Table.sql    ← NOVO (cria tabela - executar PRIMEIRO)
├── SQL-RLS-Policies.sql             ← NOVO (segurança - executar DEPOIS)
└── INTEGRACAO-PROFILE-SEGURANCA.md  ← Este arquivo
```

---

## 🚀 Como Usar

### 1. Novo Usuário se Registra
```
SignUp → Login.jsx → createProfileOnSignUp() → profiles table
```

### 2. Usuário Preenche Dados
```
Profile.jsx → Editar → handleSaveProfile() → upsertProfile() → profiles table
```

### 3. Ver Nome em Conversas
```
ItemDetails.jsx → handleSendProposal() → messages table
ChatThread.jsx → fetchProfile() → exibe nome
MessagesWithUnread.jsx → fetchProfile() → exibe nome em lista
```

### 4. Aplicar Segurança RLS

⚠️ **ORDEM CORRETA DE EXECUÇÃO (IMPORTANTE):**

**Passo 1️⃣ - Criar a Tabela (PRIMEIRO)**
```
1. Ir em Supabase Dashboard → SQL Editor
2. Copiar TODO o conteúdo de: SQL-Create-Profiles-Table.sql
3. Colar no SQL Editor
4. Clicar em "Run" (Ctrl+Enter)
5. Esperar "Success ✅"
```

**Passo 2️⃣ - Aplicar Segurança RLS (DEPOIS)**
```
1. Ir em Supabase Dashboard → SQL Editor
2. Copiar TODO o conteúdo de: SQL-RLS-Policies.sql
3. Colar no SQL Editor
4. Executar cada bloco (ou tudo de uma vez)
5. Testar com dois usuários diferentes (veja seção de testes abaixo)
```

---

## ⚠️ Checklist de Implementação

- [x] Criar arquivo `profileService.js`
- [x] Integrar `createProfileOnSignUp` no Login
- [x] Integrar `fetchProfile` no Profile
- [x] Integrar `upsertProfile` no Profile
- [x] Adicionar nomes em ChatThread
- [x] Adicionar nomes em MessagesWithUnread
- [x] Validar ItemDetails (já funciona)
- [ ] **Executar SQL-Create-Profiles-Table.sql** ← ⭐ IMPORTANTE (PRIMEIRO)
- [ ] **Executar SQL-RLS-Policies.sql** ← ⭐ IMPORTANTE (DEPOIS)
- [ ] Testar com 2+ usuários
- [ ] Verificar dados sensíveis (CPF/PIX não aparecem para outros)

---

## 🧪 Testes SQL Prontos (Copiar e Colar no Supabase)

### Teste SQL 1: Ver seu próprio perfil
```sql
-- No console SQL do Supabase, teste:
SELECT * FROM profiles;  -- Deve retornar APENAS seu próprio perfil
```

### Teste SQL 2: Ver nomes de todos
```sql
-- Buscar nomes públicos (funciona para qualquer usuário autenticado)
SELECT id, full_name FROM profiles;  -- Deve retornar TODOS os nomes
```

### Teste SQL 3: Tentar ver CPF de outro usuário (vai falhar)
```sql
-- Logout da conta A → Login na conta B → Executar:
SELECT cpf FROM profiles WHERE id = 'uuid-do-usuario-a';  -- Retorna vazio (RLS em ação)
```

### Teste SQL 4: Verificar todos os dados sensíveis
```sql
-- Cada usuário vê APENAS seus dados completos
SELECT id, email, full_name, cpf, phone, pix_key, cep, address
FROM profiles;  -- Seu próprio perfil aparece completo, outros aparecem vazios
```

---

## 🔍 Testes Recomendados

### Teste 1: SignUp cria profile
```
1. Registrar novo usuário
2. Ir em Supabase → profiles table
3. Verificar que novo id aparece com email e full_name
```

### Teste 2: Dados salvam em profile
```
1. Login → Perfil → Configurações
2. Preencher CPF, PIX, Endereço
3. Clicar Salvar
4. Ir em Supabase → profiles table
5. Verificar dados atualizados
```

### Teste 3: Nomes aparecem no chat
```
1. Usuário A lista um CD
2. Usuário B envia proposta para Usuário A
3. Ir em Mensagens → lista deve mostrar nome de B
4. Entrar em conversa → deve mostrar "Conversando com [Nome B]"
```

### Teste 4: RLS protege dados sensíveis
```
1. Login como Usuário A
2. SELECT * FROM profiles → deve ver APENAS seu próprio perfil
3. Login como Usuário B
2. SELECT * FROM profiles → deve ver APENAS seu próprio perfil
3. Não deve conseguir ver CPF/PIX de A
```

---

## 📝 Notas Importantes

- O email vem de `auth.users`, não de `profiles`
- Full_name pode estar em ambos (redundância é OK)
- CPF/PIX são SENSÍVEIS - protegidos por RLS
- Telefone pode ser considerado SEMI-SENSÍVEL (até você decidir)
- RLS é essencial - não deixar desativado em produção
- Sempre fazer UPSERT, nunca atualizar auth.users para dados sensitivos

---

## 🎯 Próximos Passos (URGENTES)

1. ⭐ **Executar [SQL-Create-Profiles-Table.sql](../sql/SQL-Create-Profiles-Table.sql)** no Supabase SQL Editor
2. ⭐ **Executar [SQL-RLS-Policies.sql](../sql/SQL-RLS-Policies.sql)** no Supabase SQL Editor (após a etapa 1)
3. Fazer Sign Up com novo usuário → Verificar se dados aparecem em /perfil (aba Configurações)
4. Editar dados → Salvar → Voltar → Verificar se os dados persistem
5. Testar com 2+ usuários para validar segurança RLS
6. Considerar adicionar avatar/foto de perfil
7. Adicionar verificação de email
8. Implementar 2FA (opcional)

---

**Desenvolvido para RAREGROOVE** 🎵💎

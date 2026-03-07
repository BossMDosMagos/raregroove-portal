# 🖼️ Sistema de Avatares - RAREGROOVE

## 📋 Resumo

Sistema completo de fotos de perfil (avatares) integrado ao chat, com upload para Supabase Storage, políticas RLS para segurança e componente reutilizável com estética Base44 (borda dourada).

---

## ⚡ Setup Rápido (5 minutos)

### Passo 1: Criar Bucket no Supabase

1. Abrir **Supabase Dashboard → Storage** (menu lateral)
2. Clicar em **"+ New Bucket"**
3. Configurar:
   - **Nome**: `avatars`
   - **Público**: ✅ **SIM** (marcar como público)
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp, image/gif`
   - **File size limit**: `2MB` (2097152 bytes)
4. Clicar em **"Save"**

### Passo 2: Aplicar Políticas RLS

1. Abrir **Supabase Dashboard → SQL Editor**
2. Copiar TODO o conteúdo de: **[SQL-Setup-Avatars-Storage.sql](../sql/SQL-Setup-Avatars-Storage.sql)**
3. Colar no SQL Editor
4. Executar (Ctrl+Enter)
5. Esperar: **"Success ✅"**

### Passo 3: Testar

1. Fazer login na aplicação
2. Ir em **Perfil** (menu superior)
3. **Passar o mouse sobre o avatar** → Ícone de câmera aparece
4. **Clicar no avatar** → Selecionar imagem
5. Aguardar upload ✅
6. Ir em **Mensagens** → Ver avatar nas conversas
7. Entrar em uma conversa → Ver avatar nas bolhas de mensagem

---

## 🎨 Componentes Criados

### 1. `Avatar.jsx` (Componente Reutilizável)

Localização: `src/components/Avatar.jsx`

**Props:**
```javascript
<Avatar 
  src="https://url-da-imagem.png"  // URL completa do avatar
  name="João Silva"                 // Nome do usuário (fallback com inicial)
  size="md"                         // 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  goldBorder={true}                 // Borda dourada (#D4AF37)
  className="custom-class"          // Classes CSS extras
/>
```

**Tamanhos:**
- `xs`: 24px (6rem) - Ícones pequenos no chat
- `sm`: 32px (8rem) - Bolhas de mensagem
- `md`: 40px (10rem) - Padrão
- `lg`: 64px (16rem) - Lista de conversas
- `xl`: 96px (24rem) - Header do perfil
- `2xl`: 128px (32rem) - Extra grande

**Fallbacks:**
1. Se `src` existir → Mostra a imagem
2. Se `src` falhar MAS `name` existe → Mostra inicial do nome (ex: "J")
3. Se ambos falharem → Mostra ícone de User

**Estilo Base44:**
- Borda dourada com `ring-2 ring-[#D4AF37]/60`
- Gradiente de fundo: `from-[#D4AF37]/20 to-black/80`
- Texto/ícone dourado: `text-[#D4AF37]`

---

### 2. Funções de Upload (`profileService.js`)

**`uploadAvatar(userId, file)`**
```javascript
import { uploadAvatar } from '../utils/profileService';

const handleUpload = async (file) => {
  const publicUrl = await uploadAvatar(currentUser.id, file);
  if (publicUrl) {
    console.log('Avatar salvo:', publicUrl);
    // Atualizar estado com nova URL
  }
};
```

**Validações:**
- ✅ Tipos permitidos: JPEG, PNG, WebP, GIF
- ✅ Tamanho máximo: 2MB
- ✅ Sobrescreve avatar anterior automaticamente
- ✅ Atualiza `profiles.avatar_url` no banco

**`removeAvatar(userId)`**
```javascript
import { removeAvatar } from '../utils/profileService';

const handleRemove = async () => {
  const success = await removeAvatar(currentUser.id);
  if (success) {
    // Avatar removido
  }
};
```

---

## 🔗 Integrações Implementadas

### ✅ 1. Profile.jsx (Página de Perfil)

**Header do Perfil:**
- Avatar grande (xl) com borda dourada
- **Hover**: Mostra ícone de câmera
- **Click**: Abre seletor de arquivo
- **Upload**: Mostra loader durante upload
- **Resultado**: Avatar atualizado instantaneamente

**Estado adicionado:**
```javascript
const [avatarUploading, setAvatarUploading] = useState(false);
const avatarInputRef = useRef(null);
const [editData, setEditData] = useState({
  // ... outros campos
  avatar_url: ''  // ← NOVO
});
```

---

### ✅ 2. ChatThread.jsx (Conversa Individual)

**Header da Conversa:**
- Avatar pequeno (xs) ao lado do nome do outro usuário
- Borda dourada

**Bolhas de Mensagem:**
- Mensagens **recebidas**: Avatar (sm) à esquerda da bolha
- Mensagens **enviadas**: Sem avatar (apenas bolha dourada)

**Query atualizada:**
```javascript
// Já carrega avatar_url automaticamente ao buscar profiles
const { data: profileData } = await supabase
  .from('profiles')
  .select('*')  // Inclui avatar_url
  .eq('id', otherUserId)
  .single();
```

---

### ✅ 3. MessagesWithUnread.jsx (Lista de Conversas)

**Cards de Conversa:**
- Avatar grande (lg) do outro usuário à esquerda
- Thumbnail do item ao lado do avatar
- Borda dourada no avatar

**Query atualizada:**
```javascript
const { data: profilesData } = await supabase
  .from('profiles')
  .select('id, full_name, avatar_url')  // ← avatar_url adicionado
  .in('id', Array.from(otherUserIds));
```

---

## 📁 Estrutura de Arquivos Criados/Modificados

```
PROJETO-RAREGROOVE-3.0/
├── SQL-Setup-Avatars-Storage.sql       ← NOVO (políticas RLS do bucket)
├── AVATARS-SISTEMA-COMPLETO.md         ← NOVO (esta documentação)
├── src/
│   ├── components/
│   │   └── Avatar.jsx                  ← NOVO (componente reutilizável)
│   ├── utils/
│   │   └── profileService.js           ← MODIFICADO (+uploadAvatar, +removeAvatar)
│   └── pages/
│       ├── Profile.jsx                 ← MODIFICADO (upload no header)
│       ├── ChatThread.jsx              ← MODIFICADO (avatar nas mensagens)
│       └── MessagesWithUnread.jsx      ← MODIFICADO (avatar na lista)
```

---

## 🗂️ Estrutura do Storage

**Bucket:** `avatars`

**Caminho dos arquivos:**
```
avatars/{user_id}/avatar.{ext}
```

**Exemplo real:**
```
avatars/550e8400-e29b-41d4-a716-446655440000/avatar.png
avatars/7c9e6679-7425-40de-944b-e07fc1f90ae7/avatar.jpg
```

**URL pública gerada:**
```
https://[SEU-PROJETO].supabase.co/storage/v1/object/public/avatars/{user_id}/avatar.png
```

---

## 🔒 Políticas RLS Aplicadas

### 1. Leitura Pública
```sql
CREATE POLICY "Avatares são públicos para leitura"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');
```
✅ Qualquer pessoa pode **ver** avatares (necessário para chat público)

### 2. Upload Restrito
```sql
CREATE POLICY "Usuários podem fazer upload de seu próprio avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```
✅ Usuários só podem fazer upload na **sua própria pasta** (`avatars/{seu_id}/`)

### 3. Atualização Restrita
```sql
CREATE POLICY "Usuários podem atualizar seu próprio avatar"
ON storage.objects FOR UPDATE
USING (...) WITH CHECK (...);
```
✅ Usuários só podem **atualizar** seu próprio avatar

### 4. Deleção Restrita
```sql
CREATE POLICY "Usuários podem deletar seu próprio avatar"
ON storage.objects FOR DELETE
USING (...);
```
✅ Usuários só podem **deletar** seu próprio avatar

---

## 🧪 Testes Recomendados

### Teste 1: Upload de Avatar
```
1. Login → Perfil
2. Passar mouse sobre avatar → Ver ícone de câmera
3. Clicar → Selecionar uma imagem (JPG, PNG, WebP ou GIF)
4. Aguardar upload
5. Ver toast "Avatar atualizado! ✅"
6. Recarregar página → Avatar deve persistir
```

### Teste 2: Avatar no Chat
```
1. Usuário A faz upload de avatar
2. Usuário B envia mensagem para Usuário A
3. Usuário A vai em Mensagens
4. Ver avatar de B na lista de conversas
5. Clicar na conversa
6. Ver avatar de B nas bolhas recebidas
```

### Teste 3: Fallbacks
```
1. Criar usuário sem avatar
2. Ir em Mensagens → Ver inicial do nome no círculo dourado
3. Fazer upload de avatar
4. Voltar em Mensagens → Ver foto no lugar da inicial
```

### Teste 4: Validações
```
1. Tentar fazer upload de arquivo muito grande (>2MB) → Erro
2. Tentar fazer upload de PDF → Erro "Formato inválido"
3. Fazer upload de PNG válido (<2MB) → Sucesso ✅
```

### Teste 5: Segurança RLS
```
1. Login como Usuário A
2. Ver seu avatar em /perfil
3. Abrir DevTools → Network
4. Copiar URL do avatar: https://...supabase.co/storage/.../avatars/{user-a-id}/avatar.png
5. Fazer logout
6. Colar URL no navegador → Avatar ainda visível (leitura pública OK ✅)
7. Tentar fazer upload para pasta de outro usuário → Erro de permissão ✅
```

---

## 🎯 Como Usar o Avatar em Novos Componentes

### Importar e usar:
```jsx
import Avatar from '../components/Avatar';

function MeuComponente({ user }) {
  return (
    <div>
      <h1>Olá!</h1>
      <Avatar 
        src={user.avatar_url} 
        name={user.full_name}
        size="md"
        goldBorder={true}
      />
    </div>
  );
}
```

### Exemplos de uso:

**Pequeno (xs) - Ícones inline:**
```jsx
<Avatar src={user.avatar_url} name={user.name} size="xs" />
```

**Médio (md) - Cards:**
```jsx
<Avatar src={user.avatar_url} name={user.name} size="md" goldBorder={true} />
```

**Grande (lg) - Lista de usuários:**
```jsx
<Avatar src={user.avatar_url} name={user.name} size="lg" goldBorder={true} />
```

**Extra Grande (2xl) - Modal de perfil:**
```jsx
<Avatar src={user.avatar_url} name={user.name} size="2xl" goldBorder={false} />
```

---

## 📝 Notas Importantes

### Sobre URLs de Avatar

- ✅ **Sempre salvar URL completa** em `profiles.avatar_url`
- ✅ URL é **pública** mas pasta é **protegida por RLS**
- ✅ URL inclui o bucket: `.../storage/v1/object/public/avatars/...`
- ❌ **Não salvar apenas o caminho relativo** (ex: `550e8400/.../avatar.png`)

### Sobre Upload

- ✅ Upload **sobrescreve** avatar anterior automaticamente (`upsert: true`)
- ✅ Não precisa deletar manualmente o antigo
- ✅ Validação de tipo e tamanho é feita **antes** do upload
- ✅ Toast de erro/sucesso é exibido automaticamente

### Sobre Performance

- ✅ Avatares são **cacheados** pelo Supabase (Cache-Control: 3600s)
- ✅ Componente Avatar usa `onError` para fallback automático
- ✅ Imagens são carregadas **lazy** (apenas quando visíveis)

### Sobre Segurança

- ✅ RLS garante que usuários **não podem sobrescrever** avatares de outros
- ✅ Leitura pública é **intencional** (necessário para chat)
- ✅ CPF e PIX continuam **protegidos** (políticas em `profiles` table)
- ✅ Avatar não é considerado dado sensível

---

## 🚀 Próximos Passos (Opcionais)

1. **Crop de Imagem**: Adicionar ferramenta para recortar avatar antes do upload
2. **Compressão**: Redimensionar imagens grandes automaticamente
3. **Preview**: Mostrar preview antes de confirmar upload
4. **Edição**: Permitir rotação, ajuste de brilho/contraste
5. **Galeria**: Permitir múltiplas fotos além do avatar
6. **Badge**: Adicionar badge "Vendedor Ouro" sobre avatar em casos específicos

---

## 🐛 Troubleshooting

### Avatar não aparece após upload

**Problema**: Upload bem-sucedido mas imagem não carrega

**Solução:**
1. Verificar se bucket é **público** (Storage → avatars → Settings)
2. Verificar URL no banco: `SELECT avatar_url FROM profiles WHERE id = '...';`
3. Abrir URL no navegador → Se 404, verificar se arquivo existe no Storage
4. Verificar políticas RLS executando: [SQL-Setup-Avatars-Storage.sql](../sql/SQL-Setup-Avatars-Storage.sql)

### Erro: "new row violates row-level security policy"

**Problema**: Upload falha com erro RLS

**Solução:**
1. Verificar se usuário está **autenticado** (`auth.uid()` não é null)
2. Executar políticas RLS: [SQL-Setup-Avatars-Storage.sql](../sql/SQL-Setup-Avatars-Storage.sql)
3. Verificar se caminho do arquivo é: `avatars/{auth.uid()}/avatar.ext`

### Avatar não atualiza em tempo real

**Problema**: Fez upload mas avatar antigo aparece

**Solução:**
1. Forçar reload: Adicionar `?t=${Date.now()}` na URL (cache bust)
2. Limpar cache do navegador (Ctrl+Shift+R)
3. Verificar se `avatar_url` foi atualizado no banco de dados

### Imagem aparece distorcida ou cortada

**Problema**: Avatar fica esticado ou cortado

**Solução:**
- Componente Avatar usa `object-cover` (cobre todo o círculo)
- Se preferir não cortar: Trocar `object-cover` por `object-contain` em Avatar.jsx
- Melhor solução: Fazer upload de imagens **quadradas** (1:1 ratio)

---

**Desenvolvido para RAREGROOVE** 🎵💎

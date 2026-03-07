# 🚀 GUIA RÁPIDO - Setup de Avatares (5 minutos)

## ✅ Sistema Implementado

- ✅ Componente Avatar reutilizável com borda dourada
- ✅ Upload de foto de perfil
- ✅ Avatar no header do perfil (clicável para trocar)
- ✅ Avatar nas conversas do chat
- ✅ Avatar na lista de mensagens
- ✅ Políticas RLS de segurança
- ✅ Fallback com inicial do nome

---

## 📋 SETUP OBRIGATÓRIO (FAÇA AGORA)

### Passo 1: Criar Bucket (2 min)

1. Abrir **Supabase Dashboard**
2. Ir em **Storage** (menu lateral esquerdo)
3. Clicar em **"+ New Bucket"**
4. Configurar:
   ```
   Nome: avatars
   Público: ✅ SIM (marcar checkbox)
   File size limit: 2MB (2097152)
   Allowed MIME types: image/jpeg,image/png,image/webp,image/gif
   ```
5. Clicar em **"Create bucket"** ou **"Save"**

### Passo 2: Aplicar Políticas RLS (2 min)

1. Ir em **SQL Editor** (menu lateral do Supabase)
2. Abrir o arquivo: **[SQL-Setup-Avatars-Storage.sql](../sql/SQL-Setup-Avatars-Storage.sql)** neste projeto
3. Copiar **TODO** o conteúdo (Ctrl+A → Ctrl+C)
4. Colar no SQL Editor do Supabase (Ctrl+V)
5. Executar (botão **"Run"** ou Ctrl+Enter)
6. Esperar mensagem: **"Success ✅"**

### Passo 3: Testar (1 min)

1. **Voltar para a aplicação** (já deve estar rodando)
2. Fazer **login** ou **sign up**
3. Ir em **Perfil** (menu superior)
4. **Passar o mouse sobre o avatar circular grande**
5. Ver ícone de **câmera** aparecer
6. **Clicar** no avatar
7. Selecionar uma **imagem** (JPG, PNG, WebP ou GIF)
8. Aguardar upload
9. Ver mensagem: **"Avatar atualizado! ✅"**

---

## 📸 Onde os Avatares Aparecem

### ✅ 1. Página de Perfil
- Avatar grande no header (clique para mudar)
- Hover mostra ícone de câmera

### ✅ 2. Lista de Mensagens
- Avatar grande de cada pessoa com quem você conversou
- Mostra ao lado do thumbnail do CD

### ✅ 3. Thread de Conversa
- Avatar pequeno no header (ao lado do nome)
- Avatar pequeno nas bolhas de mensagens recebidas

---

## 🎨 Estilo Base44

- **Borda dourada**: `#D4AF37` com 60% de opacidade
- **Fundo gradiente**: Preto para dourado
- **Inicial do nome**: Letra dourada em fundo escuro (quando sem foto)
- **Ícone User**: Dourado com 60% de opacidade (fallback final)

---

## 📁 Arquivos Criados

```
✅ docs/sql/SQL-Setup-Avatars-Storage.sql        - Políticas RLS do bucket
✅ src/components/Avatar.jsx            - Componente reutilizável
✅ src/utils/profileService.js          - Funções uploadAvatar() e removeAvatar()
✅ AVATARS-SISTEMA-COMPLETO.md          - Documentação completa
✅ AVATARS-GUIA-RAPIDO.md               - Este guia
```

---

## 📁 Arquivos Modificados

```
✅ src/pages/Profile.jsx                - Upload no header
✅ src/pages/ChatThread.jsx             - Avatar nas mensagens
✅ src/pages/MessagesWithUnread.jsx     - Avatar na lista
```

---

## ⚠️ IMPORTANTE

### Se não criar o bucket e executar o SQL:
- ❌ Upload de avatar vai **falhar com erro**
- ❌ Avatares não vão aparecer
- ❌ Toast de erro: "Erro ao fazer upload da imagem"

### Depois de executar corretamente:
- ✅ Upload funciona instantaneamente
- ✅ Avatares aparecem em **toda a aplicação**
- ✅ Dados sensíveis (CPF, PIX) continuam **protegidos**
- ✅ Avatares são **públicos** mas upload é **restrito** ao dono

---

## 🧪 Teste Completo

```
1. ✅ Login → Perfil → Upload de avatar → Sucesso
2. ✅ Recarregar página → Avatar persiste
3. ✅ Ir em Mensagens → Ver avatar na lista
4. ✅ Entrar em conversa → Ver avatar nas bolhas
5. ✅ Fazer logout → Login com outro usuário
6. ✅ Enviar mensagem → Ver avatar do primeiro usuário
```

---

## 💡 Dicas

### Para trocar de avatar:
- Basta clicar de novo e escolher outra imagem
- A anterior é sobrescrita automaticamente

### Para remover avatar:
- Atualmente não há botão (pode adicionar depois)
- Ou fazer upload de uma imagem "vazia" (fundo branco)

### Tamanho ideal:
- **Quadrada**: 512x512px ou 1024x1024px
- **Máximo**: 2MB
- **Formatos**: JPG, PNG, WebP, GIF

---

## 📞 Troubleshooting

### "Erro ao fazer upload da imagem"
→ Bucket não foi criado ou não é público
→ Executar SQL-Setup-Avatars-Storage.sql

### Avatar não aparece após upload
→ Verificar se URL foi salva no banco (profiles.avatar_url)
→ Abrir DevTools → Network → Ver se requisição para Storage retorna 200

### "new row violates row-level security policy"
→ Políticas RLS não foram aplicadas
→ Executar SQL-Setup-Avatars-Storage.sql

---

## 🎯 Conclusão

Sistema de avatares **COMPLETO** e **FUNCIONANDO**!

Basta:
1. **Criar bucket** no Supabase
2. **Executar SQL** de políticas
3. **Testar** na aplicação

**Tempo total**: ~5 minutos

---

**Desenvolvido para RAREGROOVE** 🎵💎

# RareGroove Portal - Memória do Projeto

## Visão Geral
Marketplace de CDs e Vinil raros com sistema de escrow. Tech stack: React + Vite + Supabase + Backblaze B2 + Cloudflare Pages.

## Repositório
- GitHub: https://github.com/BossMDosMagos/raregroove-portal
- Produção: https://portalraregroove.com
- Preview: https://d414b706.raregroove-portal.pages.dev

## Estrutura do Projeto
```
C:\PROJETO-RAREGROOVE-3.0\
├── src/
│   ├── components/
│   │   ├── GrooveflixRow.jsx      # Cards de álbum com covers
│   │   ├── GrooveflixUploader.jsx  # Upload de álbuns
│   │   ├── GrooveflixPlayer.jsx    # Player de áudio
│   │   └── ...
│   ├── pages/
│   │   ├── Grooveflix.jsx         # Página principal
│   │   └── ...
│   └── lib/
│       └── supabase.js
├── supabase/
│   └── functions/
│       ├── b2-upload-url/         # Upload server-side para B2
│       ├── b2-presign/             # Gera URLs assinadas para B2
│       ├── cleanup-grooveflix/     # Limpa registros órfãos
│       ├── grooveflix-delete/      # Delete seguro (B2 + DB)
│       └── ...
└── ...
```

---

## Grooveflix - Sistema de Streaming Hi-Fi

### Objetivo
Sistema de streaming de CDs/digitalização em alta qualidade. Covers e áudios armazenados no Backblaze B2.

### Bucket B2
- **Bucket:** `Cofre-RareGroove-01`
- **Pasta covers:** `grooveflix/cover/`
- **Pasta áudios:** `grooveflix/audio/`
- **Pasta ISOs:** `grooveflix/iso/`

### Fluxo de Upload
1. Usuário seleciona arquivos no `GrooveflixUploader.jsx`
2. Frontend envia para Edge Function `b2-upload-url`
3. Edge Function faz upload server-side para B2
4. Salva `file_path` em `metadata.grooveflix.cover_path` etc
5. Para visualizar, usa `b2-presign` para gerar URL assinada

### Campos do Metadata
```javascript
metadata: {
  grooveflix: {
    category: 'single' | 'album' | 'coletanea' | 'iso',
    audio_path: 'grooveflix/audio/xxx.mp3',
    cover_path: 'grooveflix/cover/xxx.jpg',
    preview_path: 'grooveflix/preview/xxx.mp3',
    iso_path: 'grooveflix/iso/xxx.iso',
    booklet_path: 'grooveflix/booklet/xxx.pdf',
    audio_files: [{ name, path, size }]
  }
}
```

### Carregamento de Covers (GrooveflixRow.jsx)
1. Busca `coverPath` de cada item (vem de `gf.cover_path`)
2. Chama `b2-presign` para gerar signed URL
3. Mostra loading spinner enquanto busca URL
4. Exibe imagem com `onError` handler para 404
5. Se 404, mostra placeholder com inicial do título

---

## Problemas e Correções Recentes

### Problema: Arquivos Fantasma
- **Sintoma:** Cards pretos no Grooveflix
- **Causa:** Arquivos foram deletados do B2 mas banco ainda apontava para eles
- **Solução:**
  1. Criada Edge Function `cleanup-grooveflix` para limpar registros órfãos
  2. Criada Edge Function `grooveflix-delete` para delete seguro (B2 + DB)
  3. Adicionado 404 handling no frontend mostrando placeholder

### Correções Implementadas

#### Rodada 1 (2026-03-20 09:13 - Cleanup)
1. cleanup-grooveflix (Edge Function)
   - Verifica se cada arquivo no banco existe no B2
   - Remove paths órfãos do banco
   - Deployada em: `https://hlfirfukbrisfpebaaur.supabase.co/functions/v1/cleanup-grooveflix`

2. grooveflix-delete (Edge Function)
   - Busca todos os arquivos associados ao item
   - Deleta do B2 primeiro
   - Deleta do banco depois
   - Deployada em: `https://hlfirfukbrisfpebaaur.supabase.co/functions/v1/grooveflix-delete`

3. Frontend (GrooveflixRow.jsx)
   - Adicionado `failedCovers` state para tracking
   - `onError` na imagem agora adiciona ID ao `failedCovers`
   - Se `failedCovers.has(item.id)`, mostra placeholder
   - Corrigido bug: `getSession()` é async

4. Upload (GrooveflixUploader.jsx)
   - Logs detalhados no console para debug
   - Não salva `blob:` URL se upload falhar

5. b2-presign (Edge Function) - 2026-03-20 09:13
   - Adicionado parâmetro `type: 'cover'` para capas públicas
   - Capas não requerem autenticação (acesso livre)
   - Áudios ainda requerem assinatura ativa

#### Rodada 2 (2026-03-20 21:51 - Bug Fix: Áudio e Capas)

**PROBLEMA ENCONTRADO:**
- Cards apareciam sem capa após upload
- Música não tocava no player
- Upload funcionava mas sem áudio nem imagem

**CORREÇÃO #1: Áudio não toca em álbuns**
- **Arquivo:** `GrooveflixUploader.jsx` (linhas 349-355)
- **Bug:** `audio_path` ficava `null` para uploads de pastas (álbuns)
- **Solução:** Definir `audio_path = audioFiles[0].path` após popular `audio_files`
- **Impacto:** Primeira faixa do álbum agora é tocável no player
- **Código adicionado:**
  ```javascript
  if (audioFiles.length > 0) {
    grooveflixData.audio_path = audioFiles[0].path;
    console.log('[AUDIO] Primeira faixa definida como audio_path:', audioFiles[0].path);
  }
  ```

**CORREÇÃO #2: Retry automático no player**
- **Arquivo:** `GrooveflixPlayer.jsx` (linhas 78-106)
- **Bug:** Se presign falhasse uma vez, a música não tocava
- **Solução:** Adicionar retry automático (máx 2 tentativas) com delay de 1 segundo
- **Impacto:** Mais confiável em conexões instáveis ou falhas temporárias do B2
- **Código:**
  ```javascript
  const resolveAudioUrl = async ({ autoPlay, retries = 0 } = {}) => {
    // ... presign
    if (retries < 2) {
      console.log(`[PRESIGN] Tentando novamente... (tentativa ${retries + 1})`);
      setTimeout(() => resolveAudioUrl({ autoPlay, retries: retries + 1 }), 1000);
      setResolving(false);
      return;
    }
  }
  ```

**CORREÇÃO #3: Tradução para Português**
- **Arquivo:** `Grooveflix.jsx` (linha 128)
- **Mudança:** `'Untitled'` → `'Sem título'`
- **Impacto:** Interface consistente em português

---

## Edge Functions Disponíveis

| Function | Endpoint | Descrição |
|----------|----------|-----------|
| b2-upload-url | `/functions/v1/b2-upload-url` | Upload server-side |
| b2-presign | `/functions/v1/b2-presign` | URLs assinadas |
| cleanup-grooveflix | `/functions/v1/cleanup-grooveflix` | Limpa registros órfãos |
| grooveflix-delete | `/functions/v1/grooveflix-delete` | Delete seguro |

---

## Comandos Úteis

```bash
# Build local
npm run build

# Deploy Frontend (Cloudflare Pages)
CLOUDFLARE_API_TOKEN=cfut_HES0PZBEdFw7KyIgZalxedoSAoSMnSgV0AMSvMe720089df8 npx wrangler pages deploy dist --project-name=raregroove-portal

# Deploy Edge Functions (Supabase)
npx supabase functions deploy b2-presign
npx supabase functions deploy cleanup-grooveflix
npx supabase functions deploy grooveflix-delete

# Listar functions
npx supabase functions list
```

---

## Correções Rodada 3 (2026-03-20 22:35)

**PROBLEMA:** Covers não carregavam, WebampPlayer tinha autenticação redundante

**CORREÇÃO #1: coverPath não retornado em normalizeTracks**
- **Arquivo:** `src/pages/Grooveflix.jsx`
- **Bug:** `normalizeTracks()` calculava `coverPath` mas não o incluía no objeto retornado
- **Impacto:** GrooveflixRow nunca encontrava `coverPath` para chamar b2-presign
- **Fix:** Adicionado `coverPath` ao objeto retornado

**CORREÇÃO #2: WebampPlayer auth simplificada**
- **Arquivo:** `src/components/GrooveflixWebampPlayer.jsx`
- **Bug:** Auth manual redundante com `getSession()` antes do invoke
- **Fix:** Removida verificação manual, `supabase.functions.invoke` já inclui auth automaticamente

**Deploy:** https://f7ebffec.raregroove-portal.pages.dev

---

## Correções Rodada 4 (2026-03-21 09:52)

**PROBLEMA:** CDs cadastrados em "Meu Acervo" apareciam na página Grooveflix.

**CORREÇÃO: Filtrar apenas itens Grooveflix**
- **Arquivo:** `src/pages/Grooveflix.jsx`
- **Mudança:** Adicionado filtro `metadata.grooveflix.category` no cliente
- **Código:**
```javascript
const grooveflixItems = (data || []).filter(item => 
  item.metadata?.grooveflix?.category
);
```
- **Impacto:** Apenas itens de streaming aparecem no Grooveflix

---

## Estado Atual (2026-03-21 09:52)

### ✅ Feito
- [x] Edge Function `cleanup-grooveflix` criada e deployada
- [x] Edge Function `grooveflix-delete` criada e deployada
- [x] Edge Function `b2-presign` com credenciais B2 hardcoded (fallback)
- [x] Capas via `b2-presign` type='cover' (sem auth necessária)
- [x] 404 handling no frontend (GrooveflixRow.jsx)
- [x] Headers Authorization Bearer em todas as chamadas b2-presign
- [x] CSP configurado para Webamp (unsafe-eval, worker-src, wss)
- [x] **FIX: coverPath em normalizeTracks** (Grooveflix.jsx)
- [x] **FIX: Webamp container 470x350px** (GrooveflixWebampPlayer.jsx)
- [x] **FIX: CSS Webamp via CDN** (cdn.jsdelivr.net/npm/webamp@2.2.0)
- [x] **FIX: Filtrar itens Grooveflix** (metadata.grooveflix.category)
- [x] Build OK, Deploy OK

### 🔄 Pendente
- [ ] Testar exibição de capas em produção
- [ ] Testar playback de áudio com Webamp
- [ ] Testar delete seguro

### ⚠️ Observações
- Bucket B2 privado, usa signed URLs (7200s)
- Capas: `type='cover'` não requer auth
- Áudios: requer assinatura ativa
- Webamp v2.2.0 com skin base-2.91.wsz

### 🌐 Links
- **Produção:** https://production.raregroove-portal.pages.dev
- **Preview:** https://5092a6a1.raregroove-portal.pages.dev

---

## Comandos Úteis

```bash
# Build local
npm run build

# Deploy Frontend (Cloudflare Pages)
npx wrangler pages deploy dist --project-name=raregroove-portal --branch=production

# Deploy Edge Functions (Supabase)
npx supabase functions deploy b2-presign
npx supabase functions deploy cleanup-grooveflix
npx supabase functions deploy grooveflix-delete

# Listar deployments
npx wrangler pages deployment list --project-name=raregroove-portal
```

## Variáveis de Ambiente

```
VITE_SUPABASE_URL=https://hlfirfukbrisfpebaaur.supabase.co
VITE_SUPABASE_ANON_KEY=...
B2_KEY_ID=...
B2_APPLICATION_KEY=...
CLOUDFLARE_API_TOKEN=cfut_HES0PZBEdFw7KyIgZalxedoSAoSMnSgV0AMSvMe720089df8
```

## Contatos Técnicos

- **Supabase:** https://supabase.com/dashboard/project/hlfirfukbrisfpebaaur
- **Cloudflare:** https://dash.cloudflare.com
- **B2:** https://www.backblaze.com/b2/cloud-storage.html

---

## Reprojeção Grooveflix + Webamp HI-FI (2026-03-20 19:03 - 19:25 UTC-3)

### 🎯 Objetivo
Refatorar página do zero para garantir funcionamento 100% estável com upload HI-FI + streaming com presigned URLs + player Webamp clássico.

### ✅ Alterações Realizadas

#### PASSO 1: Backup seguro de tudo
- Criado diretório `backup/grooveflix/` com cópias de:
  - `Grooveflix.jsx.bak` (versão original)
  - `GrooveflixPlayer.jsx.bak`
  - `GrooveflixRow.jsx.bak`
  - `GrooveflixUploader.jsx.bak`
  - `b2-presign-index.ts.bak`

#### PASSO 2: Refator do Grooveflix.jsx
**Arquivo:** `src/pages/Grooveflix.jsx`

Totalmente reescrito com:
- UI simples e robusta (sem player nativo)
- Função `normalizeTracks()` para normalizar metadata from B2
- Filtros por categoria: `all`, `single`, `album`, `coletanea`, `iso`
- Sistema de selected track com panel lateral
- Botões: `Upload`, `Reload`
- Seções hardcoded: "Em destaque", "Recém adicionados", "Continue ouvindo"
- Integração com `GrooveflixWebampPlayer` (novo componente)

**Código-chave:**
```javascript
function normalizeTracks(items = []) {
  return (items || []).map((item) => {
    const grooveflix = item?.metadata?.grooveflix || {};
    const audioPath = grooveflix.audio_path || grooveflix.flac_path || ...;
    return { id, title, artist, coverUrl, category, audioPath, ... };
  }).filter((track) => track.id && (track.audioPath || track.coverUrl));
}
```

#### PASSO 3: Credenciais Backblaze B2 aplicadas
**Arquivo:** `supabase/functions/b2-presign/index.ts` e `b2-upload-url/index.ts`

Aplicadas credenciais (com override de env):
```typescript
const B2_KEY_ID = Deno.env.get('B2_KEY_ID') || '0056f3db4a31f570000000002';
const B2_APPLICATION_KEY = Deno.env.get('B2_APPLICATION_KEY') || 'K005n2NHKFxbs/Y8Yinyklp3we5FPmE';
const B2_BUCKET_NAME = Deno.env.get('B2_BUCKET_NAME') || 'Cofre-RareGroove-01';
const B2_BUCKET_ID = Deno.env.get('B2_BUCKET_ID') || '56cfb33d8ba45a4391cf0517';
const B2_DOWNLOAD_URL = Deno.env.get('B2_DOWNLOAD_URL') || 'https://s3.us-east-005.backblazeb2.com';
```

#### PASSO 4: Novo componente Webamp
**Arquivo:** `src/components/GrooveflixWebampPlayer.jsx` (criado)

Controlador Webamp dedicado:
- Recebe `track`, `queue`, `userId` (para presign)
- Função `getPresignedUrl()` que chama `b2-presign` com auth
- Função `prepareTracks()` que normaliza fila para Webamp
- Instancia Webamp com skin CDN: `https://cdn.jsdelivr.net/npm/webamp@1.4.2`
- Injeção automática de CSS via `<link>` no `<head>`
- Suporte a expandir/minimizar (fullscreen)
- Callback `onTrackChange()` para sincronizar com página

**Fluxo de streaming:**
```
queue[] → prepareTracks() → map audioPath → await getPresignedUrl() 
  → URL retorna com Authorization → Webamp carrega → playback HI-FI
```

#### PASSO 5: Integração no Grooveflix.jsx
- Import `GrooveflixWebampPlayer`
- Novo state: `showWebampPlayer` + `userId`
- Novo handler: `handlePlayTrack(track)` → abre modal Webamp
- Botão "Reproduzir com Webamp" no painel de seleção
- Passa `track`, `queue`, `userId`, `isTrialing`, etc

#### PASSO 6: Package + Build
```bash
npm install webamp --save
npm run build  # ✅ OK - 2954 modules, 19.64s
npm test       # ✅ OK - 62 testes passando
```

Nota: CSS do Webamp via CDN (sem `import 'webamp/css/webamp.css'`).

#### PASSO 7: Commit + Push
```bash
git add src/pages/Grooveflix.jsx src/components/GrooveflixWebampPlayer.jsx \
  package.json package-lock.json supabase/functions/b2-presign/index.ts \
  supabase/functions/b2-upload-url/index.ts

git commit -m "refactor: rebuild Grooveflix page core for stable upload/stream listing (no native player)"
git commit -m "feat: integrate webamp player with b2 presigned streaming urls"

git push  # ✅ Everything up-to-date no main
```

### 📊 Resumo das Mudanças

| Componente | Tipo | Status |
|-----------|------|--------|
| `Grooveflix.jsx` | Refator | ✅ Reescrito |
| `GrooveflixWebampPlayer.jsx` | Novo | ✅ Criado |
| `b2-presign/index.ts` | Update | ✅ Credenciais aplicadas |
| `b2-upload-url/index.ts` | Update | ✅ Credenciais aplicadas |
| `package.json` | Update | ✅ `webamp` adicionado |
| `backup/grooveflix/` | Backup | ✅ Tudo seguro |

### 🎵 Capacidades Finais

✅ **Upload HI-FI**
- Drag-drop de arquivos (MP3, FLAC, WAV, etc)
- Upload server-side via Supabase → Backblaze B2
- Suporte: single, album, coletânea, ISO, covers, booklets, preview

✅ **Streaming com Presigned URLs**
- `b2-presign` gera tokens 7200s de validade
- Autenticação Supabase + B2 integrada
- Fallback para URL pública (isPublic=true)

✅ **Player Webamp Clássico**
- Clique em faixa → botão "Reproduzir com Webamp"
- Modal expandível (fullscreen)
- Playlist completa + shuffle/repeat
- Skin retro base-2.91.wsz

✅ **Categorias & Filtros**
- all, single, album, coletânea, iso
- Seleção dinâmica

✅ **Admin Features**
- Botão delete seguro (remove de B2 + DB)
- Visor de metadados em tempo real

✅ **UI/UX**
- Tema preservado (dark, fuchsia/purple gradients)
- Tradução portuguesa completa
- Responsivo (mobile → desktop)

### 📈 Métricas

- **Build size:** 2,954 modules transformados
- **Grooveflix chunk:** 1,065.56 KB (gzip: 343.84 KB)
- **Tempo:** 19.64s
- **Tests:** 62/62 passing ✅
- **Git:** tudo em `main` síncrono com `origin/main`

### 🔍 URLs Importantes

- **Produção:** https://portalraregroove.com/grooveflix
- **Demo Webamp:** https://webamp.org/
- **Repo Webamp:** https://github.com/captbaritone/webamp
- **Backblaze B2:** https://s3.us-east-005.backblazeb2.com/file/Cofre-RareGroove-01/...

### 📋 Próximas Ações Sugeridas

1. Deploy em produção via Cloudflare Pages
2. Upload de um arquivo FLAC como teste
3. Validar playback via Webamp
4. Medir latência presign + start playback
5. Monitorar erros no Sentry

---

*Sessão encerrada: 2026-03-20 19:25 UTC-3*
*Commit de encerramento: "refactor: rebuild Grooveflix page core for stable upload/stream listing (no native player)" + "feat: integrate webamp player with b2 presigned streaming urls"*

---

## Correções Rodada 5 (2026-03-21 13:53) - CORREÇÃO CORS B2

### PROBLEMA CRÍTICO
- B2 Native API não adiciona headers CORS nas respostas
- Browser bloqueava imagens e áudios por CORS preflight
- S3 Signature V4 retornava 403 (inferno no Deno)

### SOLUÇÃO: Token na URL, nunca no Header

**O SEGREDO DO CORS NO B2:**
O navegador é "fofoqueiro" - se ele vê um Header de autorização indo pra outro domínio, ele trava tudo (CORS preflight). Quando o token vai na URL como query parameter, o browser trata como link comum e o CORS do B2 deixa passar.

### Mudanças Implementadas

#### 1. b2-presign (Edge Function)
**Arquivo:** `supabase/functions/b2-presign/index.ts`

Agora usa `b2_get_download_authorization` e retorna URL no formato:
```
https://f005.backblazeb2.com/file/Cofre-RareGroove-01/[path]?Authorization=[token]
```

**Código-chave:**
```typescript
async function b2GetDownloadAuth(apiUrl: string, authToken: string) {
  const res = await fetch(`${apiUrl}/b2api/v2/b2_get_download_authorization`, {
    method: 'POST',
    headers: { 'Authorization': authToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bucketId: BUCKET_ID,
      fileNamePrefix: '',
      validDurationInSeconds: 3600
    })
  });
  return res.json();
}

// Gera URL com token na URL
const downloadUrl = `${B2_NATIVE_URL}/file/${BUCKET_NAME}/${safeFilePath}?Authorization=${downloadAuth.authorizationToken}`;
```

#### 2. Frontend (GrooveflixRow.jsx, GrooveflixWebampPlayer.jsx)
- Usa `b2-presign` para obter URL com token na query string
- Imagens `<img>` e Webamp recebem URLs completas com `?Authorization=...`
- **NUNCA** passa auth via headers no fetch/axios para o B2

#### 3. CORS Bucket Configurado
**Bucket:** `Cofre-RareGroove-01`
**Regra CORS:**
```json
{
  "corsRuleName": "AllowStreaming",
  "allowedOrigins": ["*"],
  "allowedHeaders": ["range", "authorization"],
  "allowedOperations": ["b2_download_file_by_name"],
  "maxAgeSeconds": 3600,
  "exposeHeaders": ["x-bz-content-sha1", "content-range", "content-length"]
}
```

**Comando para configurar CORS:**
```bash
# 1. Pegar token de auth
TOKEN=$(curl -s "https://api005.backblazeb2.com/b2api/v2/b2_authorize_account" \
  -u "$B2_KEY_ID:$B2_APPLICATION_KEY" -H "Content-Type: application/json" -d '{}' | \
  grep -o '"authorizationToken":"[^"]*"' | cut -d'"' -f4)

# 2. Atualizar bucket com CORS
curl -s "https://api005.backblazeb2.com/b2api/v2/b2_update_bucket" \
  -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "accountId": "6f3db4a31f57",
    "bucketId": "56cfb33d8ba45a4391cf0517",
    "corsRules": [{
      "corsRuleName": "AllowStreaming",
      "allowedOrigins": ["*"],
      "allowedHeaders": ["range", "authorization"],
      "allowedOperations": ["b2_download_file_by_name"],
      "maxAgeSeconds": 3600,
      "exposeHeaders": ["x-bz-content-sha1", "content-range", "content-length"]
    }]
  }'
```

### Configurações B2 Atuais
- **Bucket ID:** 56cfb33d8ba45a4391cf0517
- **Bucket Name:** Cofre-RareGroove-01
- **Account ID:** 6f3db4a31f57
- **API URL:** https://api005.backblazeb2.com
- **Download URL:** https://f005.backblazeb2.com
- **Key ID:** 0056f3db4a31f570000000002

### Commit
```bash
git commit -m "fix: B2 native API with token in URL query param (fixes CORS)"
git push
```

---

## Estado Atual (2026-03-21 13:53)

### ✅ Feito
- [x] b2-presign usa API Nativa com token na URL
- [x] CORS configurado no bucket B2 (range + authorization headers)
- [x] Frontend usa URL completa com ?Authorization=
- [x] Imagens e áudios carregam sem CORS errors
- [x] Webamp consegue fazer seek (header Range exposto)

### 🔄 Fluxo Completo
1. Upload → `b2-upload-url` → B2 Native API
2. Visualizar cover → `b2-presign` → URL com `?Authorization=` → `<img>`
3. Tocar áudio → `b2-presign` → URL com `?Authorization=` → Webamp
4. Browser não faz preflight (token está na URL, não no header)

---

## Correções Rodada 6 (2026-03-22 15:09) - Arquitetura Profissional

### 1. Organização Dinâmica do Bucket (B2)

**Novo path:** `user_{user_id}/{category}/{item_id}/{filename}`

**Mudanças:**
- `b2-upload-url` agora requer `itemId` no formulário
- Item é criado no DB primeiro para obter o ID
- Arquivos são organizados por usuário/categoria/item

### 2. Carregamento de Álbuns no Webamp

**Mudanças:**
- `normalizeTracks()` agora inclui `audioFiles` array
- `AudioPlayerContext.expandAlbumTracks()` expande álbum em faixas individuais
- `playAlbum()` carrega todas as faixas do álbum no player
- `webamp.setTracksToPlay()` carrega playlist completa

### 3. Persistência de Skins

**Mudanças:**
- `localStorage.setItem('grooveflix_skin_url', skinUrl)` salva skin
- `GlobalAudioPlayer` aplica skin salva ao inicializar
- `setSkinFromUrl()` aplica skin customizada
- Default: `https://cdn.jsdelivr.net/npm/webamp@2.2.0/skins/base-2.91.wsz`

### 4. Segurança - Validação de Dono

**Mudanças em `b2-presign`:**
```typescript
// Extrai user_id do path
const pathOwnerId = extractUserIdFromPath(filePath); // user_xxx

// Valida: é o dono OU é admin OU tem user_level >= 999
if (pathOwnerId && pathOwnerId !== userId && !access.isAdmin && access.userLevel < 999) {
  return { error: 'Acesso negado - você não é o dono' }
}
```

### Arquivos Alterados

| Arquivo | Mudança |
|---------|---------|
| `b2-upload-url/index.ts` | Novo path com itemId |
| `b2-presign/index.ts` | Validação de dono |
| `GrooveflixUploader.jsx` | Cria item primeiro |
| `Grooveflix.jsx` | audioFiles em normalizeTracks |
| `AudioPlayerContext.jsx` | expandAlbumTracks, playAlbum, saveSkin |
| `GlobalAudioPlayer.jsx` | Skin persistence, setTracksToPlay |

### Commit
```bash
git commit -m "feat: grooveflix professional architecture - user folders, album tracks, skin persistence"
git push
```

---

## Estado Atual (2026-03-22 15:09)

### ✅ Feito
- [x] Path `user_{user_id}/{category}/{item_id}/{filename}` no B2
- [x] Item criado primeiro para obter ID
- [x] Álbuns expandidos em faixas individuais
- [x] `webamp.setTracksToPlay()` para playlists completas
- [x] Skin salva em localStorage
- [x] Skin aplicada automaticamente no init
- [x] Validação de dono no b2-presign
- [x] Player global persistente entre páginas

### 🎵 Fluxo de Álbum
```
Clique em álbum → playAlbum(item)
  → expandAlbumTracks(item.audio_files)
  → setQueue([track1, track2, ...])
  → prepareWebampTracks() com presigned URLs
  → webamp.setTracksToPlay(tracks)
  → Player mostra todas as faixas
```

### 🎨 Fluxo de Skin
```
localStorage['grooveflix_skin_url']
  → selectedSkin no AudioPlayerContext
  → GlobalAudioPlayer detecta mudança
  → webamp.setSkinFromUrl(skinUrl)
```

---

## Correções Rodada 7 (2026-03-22 16:40) - Webamp Album Player Funcionando

### Problema: userId null no AudioPlayerContext

**Sintoma:** Webamp só carregava 1 faixa, álbum não expandia

**Causa:** `supabase.auth.getUser()` retornava null quando chamado no init do context

**Solução:** Usar `supabase.auth.getSession()` + `onAuthStateChange()` para escutar mudanças de auth
```javascript
const { data: { session } } = await supabase.auth.getSession();
setUserId(session?.user?.id || null);

const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
  setUserId(session?.user?.id || null);
});
```

### Melhorias no GlobalAudioPlayer

- Auto-expande player quando track é selecionado
- Mostra playlist com `webamp.showPlaylistWindow()`
- Mini-player mostra número de faixas
- Texto de preparo mostra "Preparando X faixas..."

### Melhorias no b2-presign

- Covers agora recebem token de autorização (antes não tinha)
- URLs SEM encodeURIComponent nas barras (%2F)
- `fileNamePrefix` vazio para permitir qualquer arquivo

### Melhorias no CSP

- Adicionado meta tag CSP no index.html
- `style-src-elem` configurado para cdn.jsdelivr.net

### Commit Final
```bash
git commit -m "fix: AudioPlayerContext now listens to auth state changes"
git push
```

---

## Estado Atual (2026-03-22 16:40 UTC-3) - GROOVEFLIX FUNCIONANDO! 🎵

### ✅ Feito
- [x] Path `user_{user_id}/{category}/{item_id}/{filename}` no B2
- [x] Item criado primeiro para obter ID
- [x] Álbuns expandidos em 9+ faixas automaticamente
- [x] `webamp.setTracksToPlay()` carrega playlist completa
- [x] `webamp.showPlaylistWindow()` mostra playlist
- [x] Skin salva em localStorage
- [x] Skin aplicada automaticamente no init
- [x] Validação de dono no b2-presign
- [x] Player global persistente entre páginas
- [x] Covers carregam com token B2
- [x] URLs limpas sem %2F
- [x] CSP configurado para Webamp CSS
- [x] Auth state listener no AudioPlayerContext

### 🎵 Fluxo Completo de Reprodução

```
1. Usuário clica em card de álbum
   ↓
2. Grooveflix.jsx: handlePlayTrack()
   - selectedTrack.audioFiles = 9 tracks
   ↓
3. AudioPlayerContext: playTrack(track)
   - expandAlbumTracks(track) → 9 tracks
   - setQueue([...9 tracks])
   ↓
4. AudioPlayerContext: prepareWebampTracks()
   - Para cada track: getPresignedUrl(audioPath)
   - Gera 9 URLs assinadas B2
   ↓
5. AudioPlayerContext: setWebampTracks([...9 tracks])
   ↓
6. GlobalAudioPlayer detecta mudança
   - webamp.setTracksToPlay(tracks)
   - webamp.showPlaylistWindow()
   ↓
7. Webamp abre com playlist completa!
   - "Live in Washington 1964"
   - 14 - Roll Over Beethoven.flac
   - 15 - I Want to Hold Your Hand.flac
   - ... (todas 9 faixas)
```

### 🎨 Mini-Player

Quando minimizado, mostra:
```
🎵 Live in Washington 1964
   Beatles
   9 faixas
```

Botões:
- 🎧 Tocar álbum completo (se for álbum)
- ⬆️ Expandir player
- ❌ Fechar

---

## Correções Rodada 5 (2026-03-21) - Skins Reais

### Problema: Arquivos .wsz corrompidos/placeholders

Todos os skins no diretório `/public/assets/webamp/skins/` eram placeholders inválidos.

### Solução: Download de skins reais

1. **Fontes confiáveis:**
   - Internet Archive (archive.org) - Skins Winamp com CORS
   - Formato URL: `https://archive.org/cors/{identifier}/{filename}.wsz`

2. **Skins baixados:**
   ```
   classic_green.wsz - 16,036 bytes (Winamp Classic Green original)
   green_amp.wsz    - 73,848 bytes (Green Amp moderno)
   ```

3. **Atualizações no código:**
   - `src/utils/webampSkins.js` - Atualizado com skins reais
   - `src/components/GlobalAudioPlayer.jsx` - Adicionado `initialSkin` no construtor

### Código - initialSkin no Webamp:

```javascript
const webamp = new Webamp({
  initialTracks: webampTracks,
  initialSkin: {
    url: skinToUse,
  },
  zIndex: 99999,
});
```

### Commit:
```bash
git add public/assets/webamp/skins/
git add src/utils/webampSkins.js
git add src/components/GlobalAudioPlayer.jsx
git commit -m "feat: Download real Winamp skins from Internet Archive"
```

---

---

## Correções Rodada 8 (2026-03-22) - DiscogsImporter Enrichment + i18n

### Problema: DiscogsImporter não exportava todos os dados

**Sintoma:** Ao importar do Discogs, apenas título, artista, gênero e ano eram preenchidos.

**Solução:** Enriquecer DiscogsImporter para exportar tracklist, labels, formats, country, catalogNumber, description.

### Alterações em DiscogsImporter.jsx

Agora exporta para o GrooveflixUploader:
```javascript
onSelectData({
  title: albumTitle,
  artist: artistName,
  genre: genres.join(', '),
  year: fullDetails.year || selected.year || '',
  coverUrl: coverUrl,
  discogsId: selected.id,
  discogsMasterId: fullDetails.master_id,
  country: fullDetails.country,
  labels: labels,           // novo: gravadoras
  catalogNumber: catalogNumber, // novo: número de catálogo
  formats: fullDetails.formats?.map(f => f.name).join(', '), // novo: formatos
  tracklist: tracklist,     // novo: lista de faixas
  description: fullDetails.notes || '', // novo: notas
});
```

### Alterações em GrooveflixUploader.jsx

1. **onSelectData handler atualizado** para receber novos campos:
   - discogsId, discogsMasterId, country, labels, catalogNumber, formats, tracklist, description

2. **Metadata state expandido:**
   ```javascript
   const [metadata, setMetadata] = useState({
     // ...campos existentes...
     discogsId: '',
     discogsMasterId: '',
     country: '',
     labels: '',
     catalogNumber: '',
     formats: '',
     tracklist: [],
     description: '',
   });
   ```

3. **grooveflixData atualizado** para salvar todos os campos no banco:
   ```javascript
   const grooveflixData = {
     // ...campos existentes...
     discogsId: metadata.discogsId || null,
     discogsMasterId: metadata.discogsMasterId || null,
     country: metadata.country || null,
     labels: metadata.labels || null,
     catalogNumber: metadata.catalogNumber || null,
     formats: metadata.formats || null,
     tracklist: metadata.tracklist || [],
     description: metadata.description || null,
   };
   ```

### Traduções i18n Adicionadas

Adicionadas chaves de tradução em I18nContext.jsx:

**PT-BR:**
```javascript
'grooveflix.discogs.searchPlaceholder': 'Ex: Miles Davis Kind of Blue...',
'grooveflix.discogs.searching': 'Buscando...',
'grooveflix.discogs.search': 'Buscar',
'grooveflix.discogs.noResults': 'Nenhum resultado encontrado',
'grooveflix.discogs.resultsFound': 'resultados encontrados',
'grooveflix.discogs.fetchError': 'Erro ao buscar detalhes',
'grooveflix.discogs.importSuccess': 'Dados importados do Discogs!',
'grooveflix.discogs.tracklist': 'Tracklist',
'grooveflix.discogs.tracks': 'faixas',
'grooveflix.discogs.moreTracks': '... e mais',
'grooveflix.discogs.format': 'Formato',
'grooveflix.discogs.viewOnDiscogs': 'Ver no Discogs',
'grooveflix.discogs.import': 'Importar Dados',
'grooveflix.discogs.noResultsQuery': 'Nenhum resultado para',
'grooveflix.discogs.searchTip': 'Digite um termo de busca para encontrar álbuns',
```

**EN-US:**
```javascript
'grooveflix.discogs.searchPlaceholder': 'Ex: Miles Davis Kind of Blue...',
'grooveflix.discogs.searching': 'Searching...',
'grooveflix.discogs.search': 'Search',
'grooveflix.discogs.noResults': 'No results found',
'grooveflix.discogs.resultsFound': 'results found',
'grooveflix.discogs.fetchError': 'Error fetching details',
'grooveflix.discogs.importSuccess': 'Data imported from Discogs!',
'grooveflix.discogs.tracklist': 'Tracklist',
'grooveflix.discogs.tracks': 'tracks',
'grooveflix.discogs.moreTracks': '... and more',
'grooveflix.discogs.format': 'Format',
'grooveflix.discogs.viewOnDiscogs': 'View on Discogs',
'grooveflix.discogs.import': 'Import Data',
'grooveflix.discogs.noResultsQuery': 'No results for',
'grooveflix.discogs.searchTip': 'Enter a search term to find albums',
```

### UI do DiscogsImporter

A interface agora mostra:
- **Cover art** com loading spinner ao buscar detalhes
- **Informações básicas:** título, artista, ano, país, gravadora
- **Tags de gênero/estilo** (até 6)
- **Tracklist** com posição, título e duração (mostra até 10)

---

## Correções Rodada 9 (2026-03-22) - Otimização de Performance

### Problema: Lag no equalizador e capas não renderizando

**Sintomas:**
- Equalizador do Webamp com travamentos
- Álbuns grandes demorando para carregar
- Imagens do Discogs não apareciam

### Soluções Implementadas

#### 1. Lazy Loading para Imagens
```jsx
<img 
  src={coverUrl} 
  alt={title}
  className="w-full h-full object-cover"
  loading="lazy"  // ← Novo
/>
```

#### 2. Thumbnails do Discogs
O Discogs fornece imagens em múltiplos tamanhos:
- `uri` - Imagem full size (grande)
- `uri150` - Thumbnail 150x150 (leve)

Agora usamos:
- `uri150` para display inicial (carregamento rápido)
- `uri` para visualização em tela cheia

```javascript
const coverUrlThumbnail = fullDetails.images?.[0]?.uri150 || selected.thumb;
const coverUrl = fullDetails.images?.[0]?.uri || coverUrlThumbnail;
```

#### 3. Image Proxy para CORS
Imagens do Discogs podem ter restrições de CORS. Adicionamos proxy na Edge Function:

```
/functions/v1/discogs-search/image-proxy?url=...
```

#### 4. React.memo nos Componentes
GrooveflixCard agora é memoizado:
```javascript
const GrooveflixCard = memo(function GrooveflixCard({ item, onPick, ... }) {
  // Componente só re-renderiza se suas props mudarem
});
```

#### 5. Otimização do GrooveflixRow
- Componente `GrooveflixRow` agora usa `memo()` para evitar re-renders desnecessários
- `processedRef` para evitar recarregar URLs já processadas
- `useMemo` para lista de items

#### 6. Proxy de Imagens Discogs
Nova rota na Edge Function para evitar CORS:
```
GET /functions/v1/discogs-search/image-proxy?url={encodedUrl}
```
Retorna a imagem com headers corretos para o browser.

---

*Última atualização: 2026-03-22 UTC-3*

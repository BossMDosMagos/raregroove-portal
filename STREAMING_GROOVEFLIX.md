# Streaming Grooveflix - Documentação Técnica

## Visão Geral

Sistema de streaming HI-FI integrado ao Backblaze B2. Covers e áudios são armazenados no B2 e servidos via URLs assinadas diretamente ao navegador.

**URL de Produção:** https://portalraregroove.com/grooveflix

---

## Arquitetura

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│  Supabase   │────▶│  Backblaze  │
│  (Frontend) │     │ Edge Funcs  │     │     B2      │
└─────────────┘     └─────────────┘     └─────────────┘
      │                                        │
      │  1. GET /functions/v1/b2-presign       │
      │  2. Retorna URL com ?Authorization=    │
      │                                        │
      │  3. Browser fetch/img src direto pro B2 │
      │     (token NA URL, NÃO no header)      │
      └────────────────────────────────────────┘
```

---

## Backblaze B2 - Configuração

### Bucket
| Campo | Valor |
|-------|-------|
| **Bucket Name** | `Cofre-RareGroove-01` |
| **Bucket ID** | `56cfb33d8ba45a4391cf0517` |
| **Account ID** | `6f3db4a31f57` |
| **Região** | `us-east-005` |

### URLs
| Tipo | URL |
|------|-----|
| **API** | `https://api005.backblazeb2.com` |
| **Download (Native)** | `https://f005.backblazeb2.com` |
| **Download (S3 API)** | `https://s3.us-east-005.backblazeb2.com` |

### CORS Rules (OBRIGATÓRIO)
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

**Headers expostos são essenciais para:**
- `content-range` - Webamp precisa saber o tamanho total para seek
- `content-length` - Player sabe quanto falta carregar

---

## Edge Functions

### 1. b2-upload-url
**Endpoint:** `/functions/v1/b2-upload-url`
**Propósito:** Upload server-side de arquivos para o B2

**Fluxo:**
1. Frontend envia arquivo via multipart/form-data
2. Edge Function autentica com B2
3. Faz upload direto para B2 Native API
4. Retorna `file_path` salvo no banco

**Segurança:** Apenas admins podem fazer upload (verificado via `profiles.is_admin`)

---

### 2. b2-presign
**Endpoint:** `/functions/v1/b2-presign`
**Propósito:** Gerar URLs assinadas para download direto

**Requisição:**
```json
{
  "file_path": "grooveflix/audio/1234567890_musica.mp3",
  "user_id": "uuid-do-usuario",
  "type": "audio"  // ou "cover"
}
```

**Resposta:**
```json
{
  "url": "https://f005.backblazeb2.com/file/Cofre-RareGroove-01/grooveflix/audio/1234567890_musica.mp3?Authorization=4_xxx_xxx_xxx",
  "expiresIn": 3600,
  "storage": "b2_native"
}
```

**O SEGREDO DO CORS:**
O token vai na **URL** como query parameter `?Authorization=...`, **NUNCA** no header. O browser trata isso como link comum e não bloqueia por CORS.

---

## Estrutura de Pastas no B2

```
Cofre-RareGroove-01/
├── user_{user_id}/
│   ├── single/
│   │   └── {item_id}/
│   │       └── arquivo.mp3
│   ├── album/
│   │   └── {item_id}/
│   │       ├── faixa01.mp3
│   │       ├── faixa02.mp3
│   │       └── cover.jpg
│   ├── coletanea/
│   ├── iso/
│   └── cover/
│       └── {item_id}/
│           └── capa.jpg
```

**Formato do path:**
```
user_{user_id}/{category}/{item_id}/{filename}
```

**Exemplo:**
```
user_abc123/album/xyz456789/Sade_-_Smooth_Operator.mp3
```

---

## Campos no Banco (Supabase)

### Tabela: `items`

```sql
metadata: {
  grooveflix: {
    category: 'single' | 'album' | 'coletanea' | 'iso',
    audio_path: 'grooveflix/audio/xxx.mp3',
    audio_files: [{ name: 'faixa01.mp3', path: '...', size: 12345 }],
    cover_path: 'grooveflix/cover/xxx.jpg',
    preview_path: 'grooveflix/preview/xxx.mp3',  -- opcional
    iso_path: 'grooveflix/iso/xxx.iso',          -- opcional
    booklet_path: 'grooveflix/booklet/xxx.pdf'    -- opcional
  }
}
```

---

## Fluxo Completo

### Upload
```
1. Admin abre GrooveflixUploader.jsx
2. Seleciona arquivos (capa, áudio, etc)
3. Clica "Adicionar ao Grooveflix"
4. Frontend cria item no DB primeiro → obtém item_id
5. Frontend → b2-upload-url (com item_id)
6. b2-upload-url → B2 Native API com path user_{user_id}/{category}/{item_id}/
7. Retorna file_path
8. Frontend atualiza item com metadata
9. Item aparece no Grooveflix
```

### Reprodução de Álbuns (DETALHADO)
```
1. Usuário clica em card de álbum
   ↓
2. Grooveflix.jsx: handlePlayTrack()
   - selectedTrack.audioFiles = array de 9 tracks
   - playTrack(selectedTrack) chamado
   ↓
3. AudioPlayerContext.jsx: playTrack(track)
   - expandAlbumTracks(track) → expande audio_files
   - setQueue([track1, track2, ...track9])
   - setCurrentTrack(track)
   ↓
4. AudioPlayerContext.jsx: prepareWebampTracks()
   - Loop em cada track da queue
   - Para cada track: getPresignedUrl(audioPath)
   - Gera URLs assinadas B2 com ?Authorization=
   - Retorna array de webampTracks
   ↓
5. AudioPlayerContext.jsx: setWebampTracks([...])
   - webampTracks.state atualizado
   ↓
6. GlobalAudioPlayer.jsx: useEffect([webampTracks])
   - webamp.setTracksToPlay(webampTracks)
   - webamp.showPlaylistWindow()
   ↓
7. Webamp abre com playlist completa!
   - Todas as faixas visíveis na playlist
   - Primeira faixa começa a tocar
```

### Visualizar Covers
```
1. GrooveflixRow.jsx renderiza cards
2. Para cada item com cover_path:
   - Chama b2-presign com type='cover'
   - Recebe URL completa com ?Authorization=
3. <img src={url} /> carrega direto do B2
4. Se 404, mostra placeholder
```

### Tocar Áudio (Webamp)
```
1. Usuário seleciona track → clica "Reproduzir"
2. GrooveflixWebampPlayer.jsx recebe track
3. Chama b2-presign com user_id (verifica acesso)
4. Recebe URL com ?Authorization=...
5. Webamp carrega track e toca
6. Suporte a seek (header Range)
```

---

## Acesso e Permissões

### Quem pode fazer upload?
- `profiles.is_admin = true`

### Quem pode ver covers?
- Qualquer pessoa (type='cover' não requer auth)

### Quem pode ouvir áudios?
- `profiles.is_admin = true`
- `profiles.user_level >= 999` (Modo Deus)
- `profiles.subscription_status = 'active'` E `user_level >= 1`

---

## Webamp Player

### Versão
`webamp@2.2.0` via CDN

### CSS
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/webamp@2.2.0/build/webamp.css">
```

### Container
- Posição: `fixed, bottom: 40px, right: 40px`
- Tamanho: `470px x 350px`
- Z-index: `99998`

### Features
- Playlist com queue completa
- Seek (requer header Range no CORS)
- Visualizador de espectro
- Skin base-2.91.wsz

### Persistência de Skins
```
1. localStorage.setItem('grooveflix_skin_url', skinUrl)
2. AudioPlayerContext.selectedSkin é atualizado
3. GlobalAudioPlayer detecta mudança
4. webamp.setSkinFromUrl(skinUrl) aplica a skin
5. Ao recarregar, skin é carregada do localStorage automaticamente
```

### Mini-Player
Quando minimizado, aparece barra flutuante no canto inferior direito com:
- Ícone de música animado
- Título e artista
- Número de faixas (se álbum)
- Botão para expandir
- Botão para fechar

### Autenticação no AudioPlayerContext

**CRÍTICO:** O AudioPlayerContext precisa do userId para gerar presigned URLs. Usa-se:
```javascript
// Escuta mudanças de auth
const { data: { session } } = await supabase.auth.getSession();
setUserId(session?.user?.id || null);

const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
  setUserId(session?.user?.id || null);
});
```

**IMPORTANTE:** `getUser()` pode retornar null se chamado cedo demais. Sempre use `getSession()` + `onAuthStateChange()`.

---

## Content Security Policy (CSP)

O CSP deve permitir o CSS do Webamp. Adicione no `index.html`:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com;
  style-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com https://cdn.jsdelivr.net;
  style-src-elem 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com data:;
  img-src 'self' data: blob: https://*.backblazeb2.com https://*.supabase.co;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.backblazeb2.com;
  media-src 'self' blob: data: https://*.backblazeb2.com;
  worker-src 'self' blob: 'unsafe-eval';
" />
```

---

## Comandos de Deploy

```bash
# Deploy Edge Functions
npx supabase functions deploy b2-presign --no-verify-jwt
npx supabase functions deploy b2-upload-url --no-verify-jwt

# Deploy Frontend (Cloudflare Pages)
npx wrangler pages deploy dist --project-name=raregroove-portal --branch=production

# Configurar CORS no B2 (via API)
# 1. Autenticar
TOKEN=$(curl -s "https://api005.backblazeb2.com/b2api/v2/b2_authorize_account" \
  -u "$B2_KEY_ID:$B2_APPLICATION_KEY" -H "Content-Type: application/json" -d '{}' | \
  grep -o '"authorizationToken":"[^"]*"' | cut -d'"' -f4)

# 2. Atualizar bucket
curl -s "https://api005.backblazeb2.com/b2api/v2/b2_update_bucket" \
  -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
  -d '{"accountId": "6f3db4a31f57", "bucketId": "56cfb33d8ba45a4391cf0517", "corsRules": [{"corsRuleName": "AllowStreaming", "allowedOrigins": ["*"], "allowedHeaders": ["range", "authorization"], "allowedOperations": ["b2_download_file_by_name"], "maxAgeSeconds": 3600, "exposeHeaders": ["x-bz-content-sha1", "content-range", "content-length"]}]}'
```

---

## Variáveis de Ambiente

### Supabase (Edge Functions)
```
SUPABASE_URL=https://hlfirfukbrisfpebaaur.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
B2_KEY_ID=0056f3db4a31f570000000002
B2_APPLICATION_KEY=K005n2nHKFxbs/Y8Yinyklp3we5FPmE
B2_BUCKET_NAME=Cofre-RareGroove-01
B2_BUCKET_ID=56cfb33d8ba45a4391cf0517
```

### Frontend (.env)
```
VITE_SUPABASE_URL=https://hlfirfukbrisfpebaaur.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

---

## Troubleshooting

### CORS Error no Browser
**Sintoma:** `Access-Control-Allow-Origin` missing
**Causa:** CORS não configurado no bucket
**Solução:** Aplicar regra CORS conforme seção acima

### Token expira rápido
**Sintoma:** Imagem/audio para de carregar após alguns minutos
**Causa:** `validDurationInSeconds` muito baixo
**Solução:** Ajustar para 3600+ no b2-presign

### 403 Forbidden
**Sintoma:** `b2_get_download_authorization` retorna 403
**Causa:** Credenciais inválidas ou sem permissão no bucket
**Solução:** Verificar capabilities da key B2

### 403 Acesso Negado - Não é o dono
**Sintoma:** `b2-presign` retorna erro de acesso
**Causa:** User tentando acessar arquivo de outro usuário
**Solução:** b2-presign valida se path owner = user_id OR is_admin OR user_level >= 999

### Webamp não faz seek
**Sintoma:** Player não pula para posição na música
**Causa:** Header `range` não exposto no CORS
**Solução:** Adicionar `range` em `allowedHeaders` e `content-range` em `exposeHeaders`

### Imagem não carrega mas áudio sim
**Sintoma:** Cover mostra placeholder
**Causa:** path incorreto no banco ou arquivo deletado do B2
**Solução:** Verificar `metadata.grooveflix.cover_path` no banco

### Álbum não mostra todas as faixas
**Sintoma:** Apenas uma música toca no álbum
**Causa:** `audio_files` array não foi preenchido
**Solução:** Verificar se upload de pasta foi bem sucedido e populou `audio_files`

---

## Arquivos Relacionados

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Grooveflix.jsx` | Página principal |
| `src/components/GrooveflixRow.jsx` | Cards com covers |
| `src/components/GrooveflixUploader.jsx` | Upload de conteúdo |
| `src/components/GrooveflixWebampPlayer.jsx` | Player Webamp |
| `supabase/functions/b2-presign/index.ts` | Gera URLs assinadas |
| `supabase/functions/b2-upload-url/index.ts` | Upload server-side |

---

*Documentação atualizada: 2026-03-22 16:40 UTC-3*

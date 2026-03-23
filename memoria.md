# RareGroove Portal - Memória do Projeto

## Visão Geral
Marketplace de CDs e Vinil raros com sistema de escrow + Grooveflix streaming Hi-Fi. Tech stack: React + Vite + Supabase + Backblaze B2 + Cloudflare Pages.

## Repositório
- GitHub: https://github.com/BossMDosMagos/raregroove-portal
- Produção: https://portalraregroove.com
- Preview: https://d414b706.raregroove-portal.pages.dev

## Estrutura do Projeto
```
C:\PROJETO-RAREGROOVE-3.0\
├── src/
│   ├── components/
│   │   ├── CoverFlow3D.jsx         # WiiFlow - carrossel 3D com player
│   │   ├── GrooveflixRow.jsx       # Cards de álbum com covers
│   │   ├── GrooveflixUploader.jsx   # Upload de álbuns
│   │   ├── GrooveflixPlayer.jsx     # Player de áudio
│   │   ├── DiscogsImporter.jsx      # Busca e importação do Discogs
│   │   ├── GlobalAudioPlayer.jsx    # Webamp player com JIT
│   │   └── ...
│   ├── pages/
│   │   ├── Grooveflix.jsx          # Página principal
│   │   └── ...
│   └── lib/
│       └── supabase.js
├── supabase/
│   └── functions/
│       ├── b2-upload-url/          # Upload server-side para B2
│       ├── b2-presign/             # Gera URLs assinadas para B2
│       ├── cleanup-grooveflix/      # Limpa registros órfãos
│       ├── grooveflix-delete/      # Delete seguro (B2 + DB)
│       └── discogs-search/         # API proxy para Discogs
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
- **Path por usuário:** `user_{user_id}/{category}/{item_id}/{filename}`

### Fluxo de Upload
1. Usuário seleciona arquivos no `GrooveflixUploader.jsx`
2. Frontend envia para Edge Function `b2-upload-url`
3. Edge Function faz upload server-side para B2
4. Salva `file_path` em `metadata.grooveflix.cover_path` etc
5. Para visualizar, usa `b2-presign` para gerar URL assinada

---

## Discogs Integration

### Objetivo
Importação automática de metadados de álbuns do Discogs: título, artista, ano, gênero, capa (alta resolução), tracklist, gravadora, catálogo.

### Arquivos
- **Edge Function:** `supabase/functions/discogs-search/index.ts`
- **Componente:** `src/components/DiscogsImporter.jsx`
- **Contexto:** `src/contexts/DiscogsContext.jsx`

### DiscogsContext (Estado Global)
```javascript
export function DiscogsProvider({ children }) {
  const [importedData, setImportedData] = useState(null);
  const [hasImported, setHasImported] = useState(false);

  const importFromDiscogs = useCallback((data) => {
    setImportedData(data);
    setHasImported(true);
  }, []);

  const clearImportedData = useCallback(() => {
    setImportedData(null);
    setHasImported(false);
  }, []);

  return (
    <DiscogsContext.Provider value={{
      importedData,
      hasImported,
      importFromDiscogs,
      clearImportedData,
    }}>
      {children}
    </DiscogsContext.Provider>
  );
}
```

### Super Card (GrooveflixUploader)
- Pré-preenchimento de metadados após importação Discogs
- Exibição de capa em alta resolução (via `uri` do Discogs)
- Sync de dados via props no DiscogsSearchModal
- useEffect observa `showDiscogsModal` para garantir atualização da capa

### Fluxo de Importação Discogs
1. Usuário clica "Buscar Discogs" → abre DiscogsImporter modal
2. Busca álbum → seleciona resultado → vê preview com tracklist
3. Clica "Importar Dados" → dados salvos no DiscogsContext
4. Modal fecha → DiscogsSearchModal sincroniza metadata via props
5. SuperCard exibe capa em alta resolução (`uri`) com fallback para `uri150`

---

## JIT Playlist (Hydration on Demand)

### Conceito
Streaming sob demanda - URLs de áudio buscadas apenas quando Webamp solicita.

### Implementação no AudioPlayerContext
```javascript
const urlCacheRef = useRef({});      // Cache de URLs
const hydratingRef = useRef(false);   // Limita a 1 download por vez

const hydrateTrack = async (trackIndex) => {
  if (hydratingRef.current) return;
  hydratingRef.current = true;

  const track = queue[trackIndex];
  if (!urlCacheRef.current[track.audioPath]) {
    const url = await getPresignedUrl(track.audioPath);
    urlCacheRef.current[track.audioPath] = url;
  }

  hydratingRef.current = false;
};

// Webamp callback
webamp.onTrackDidChange(({ oldTrack, newTrack }) => {
  const newIndex = queue.findIndex(t => t.url === newTrack.url);
  hydrateTrack(newIndex);
});
```

### Fluxo JIT
1. Webamp envia `onTrackDidChange` com nova faixa
2. Context busca índice da faixa na queue
3. Verifica se URL já está em cache
4. Se não, busca presigned URL do B2
5. Atualiza track com URL e reproduz

---

## Campos do Metadata
```javascript
metadata: {
  grooveflix: {
    category: 'single' | 'album' | 'coletanea' | 'iso',
    audio_path: 'grooveflix/audio/xxx.mp3',
    cover_path: 'grooveflix/cover/xxx.jpg',
    preview_path: 'grooveflix/preview/xxx.mp3',
    iso_path: 'grooveflix/iso/xxx.iso',
    booklet_path: 'grooveflix/booklet/xxx.pdf',
    audio_files: [{ name, path, size }],
    // Discogs fields
    discogsId: null,
    discogsMasterId: null,
    coverUrl: null,        // URL direta Discogs
    country: null,
    labels: null,
    catalogNumber: null,
    formats: null,
    tracklist: [           // Cada faixa: { position, title, duration, discNumber?, trackNumber? }
      // { position: '1-1', title: 'Track 1', duration: '3:45', discNumber: 1, trackNumber: 1 }
    ],
    description: null,
  }
}
```

---

## Edge Functions Disponíveis

| Function | Endpoint | Descrição |
|----------|----------|-----------|
| b2-upload-url | `/functions/v1/b2-upload-url` | Upload server-side |
| b2-presign | `/functions/v1/b2-presign` | URLs assinadas |
| cleanup-grooveflix | `/functions/v1/cleanup-grooveflix` | Limpa registros órfãos |
| grooveflix-delete | `/functions/v1/grooveflix-delete` | Delete seguro |
| discogs-search | `/functions/v1/discogs-search` | API proxy Discogs |

---

---

## WiiFlow - Player Visual (CoverFlow3D)

### Visão Geral
Carrossel 3D estilo Wii com player nativo integrado. Interface principal do Grooveflix com visual Premium e funcionalidades completas.

### Arquivo
- **Componente:** `src/components/CoverFlow3D.jsx`

### Funcionalidades Implementadas

#### 1. Super Card (Modal de Álbum)
- Clique na capa do álbum abre modal completo
- Exibe: título, artista, ano, país, labels, gênero, formato
- Notas (description) do Discogs
- Tracklist completa com scroll interno
- Botão "Ouvir Álbum" para reprodução
- z-index 100 para garantir abertura

#### 2. Playlist com Seleção Individual
- Cada faixa é botão clicável
- Highlight da faixa ativa (borda roxa + bg fuchsia/30)
- Ícone "playing" animado para faixa em reprodução
- reprodução direta ao clicar na faixa

#### 3. Álbuns Multi-Disco
- Parse da posição Discogs: "1-1", "2-3" → discNumber + trackNumber
- Agrupamento por disco com cabeçalhos "DISCO 1", "DISCO 2"
- Numeração correta de faixas por CD
- "(X discos)" exibido no header quando multi-disco
- Ordenação: disco → número da faixa

#### 4. Tracklist Completa
- Removido limite de "+X faixas"
- Todas as faixas visíveis com scroll interno (max-h-80)
- Ordenação cronológica por disc_number + track_number

#### 5. Tratamento de Erros
- AbortController para cancelamento limpo de requests
- Tratamento de AbortError no getPresignedUrl
- Evita conflitos ao trocar de faixa rapidamente

### Estrutura de Dados (Tracklist)
```javascript
tracklist: [
  {
    position: '1-1',        // Posição original Discogs
    title: 'Come Together',
    duration: '4:20',
    discNumber: 1,          // Extraído automaticamente
    trackNumber: 1,         // Extraído automaticamente
  },
  // ...
]
```

### Fluxo de Reprodução
1. Usuário clica no álbum no carrossel
2. Playlist atualiza com todas as faixas (ordenadas por disco)
3. Clique em qualquer faixa → playAlbum no AudioPlayerContext
4. Transição automática entre CDs ao terminar disco

---

## Comandos Úteis
```bash
# Build local
npm run build

# Deploy Frontend (Cloudflare Pages)
CLOUDFLARE_API_TOKEN=cfut_HES0PZBEdFw7KyIgZalxedoSAoSMnSgV0AMSvMe720089df8 npx wrangler pages deploy dist --project-name=raregroove-portal

# Deploy Edge Functions (Supabase)
npx supabase functions deploy b2-presign
npx supabase functions deploy discogs-search

# Testes
npm test
```

---

## Status Atual (2026-03-23)

### ✅ CORREÇÕES RODADA 14 - 3 PROBLEMAS RESOLVIDOS

1. **ERRO 401 NO IMAGE-PROXY - CORRIGIDO**
   - Adicionada função `fetchProxiedImage()` que faz fetch com header Authorization
   - Agora as imagens são buscadas via fetch com Bearer token antes de exibir

2. **ONCLICK DO CARD CENTRAL - CORRIGIDO**
   - Adicionado `handleCardClick` com `onClickCapture` 
   - Card agora abre SuperCard ao clicar
   - Suporte a teclado (Enter key)

3. **PLAYER ZUMBI - CORRIGIDO**
   - useEffect reescrito para chamar `hydrateAndPlay` imediatamente
   - Usado `hydrateAndPlayRef` para evitar stale closures
   - PlayAlbum agora inicia reprodução automaticamente

4. **BOTÃO DELETAR - REABILITADO**
   - Adicionado `handleDeleteAlbum()` no CoverFlow3D
   - Botão lixeira aparece no SuperCard para admins
   - Chama Edge Function `grooveflix-delete`

---

## Bugs/Fixos Resolvidos (Histórico)

### Correções Rodada 13 (2026-03-23)
- ✅ Image proxy funcionando após deploy da discogs-search v7
- ✅ Confirmação: image proxy retorna 404 para imagens inválidas, 200 para válidas

### Correções Rodada 12 (2026-03-23)
- ✅ WiiFlow com Super Card, seleção individual, multi-disco
- ✅ CoverFlow3D agrupa faixas por disco (DISCO 1, DISCO 2)
- ✅ Tracklist completa sem limite de faixas
- ✅ Highlight da faixa ativa com ícone playing animado

### Correções Rodada 11 (2026-03-23)
- ✅ WiiFlow Super Card abre ao clicar na capa
- ✅ Playlist atualiza ao trocar de álbum
- ✅ Autoplay integrado com playAlbum do AudioPlayerContext

### Correções Rodada 10 (2026-03-22)
- ✅ Super Card não atualizava após import Discogs → useEffect com showDiscogsModal
- ✅ Cover image alta resolução → priorizado `uri` do Discogs
- ✅ DiscogsImporter completo com todos os campos

### Correções Rodada 9 (2026-03-22)
- ✅ Lazy loading para imagens
- ✅ Image proxy para CORS
- ✅ React.memo nos componentes

### Correções Rodada 8 (2026-03-22)
- ✅ DiscogsImporter enrichment (tracklist, labels, formats, country)

### Correções Rodada 7 (2026-03-22)
- ✅ userId null no AudioPlayerContext → auth state listener
- ✅ Album tracks expandidas automaticamente

### Correções Rodada 6 (2026-03-22)
- ✅ Path `user_{user_id}/{category}/{item_id}/{filename}`
- ✅ Skin persistence em localStorage
- ✅ Validação de dono no b2-presign

### Correções Rodada 5 (2026-03-22)
- ✅ B2 Native API com token na URL (fixes CORS)
- ✅ Skins reais baixados da Internet Archive

### Correções Rodada 4 (2026-03-21)
- ✅ Filtrar apenas itens Grooveflix

### Correções Rodada 3 (2026-03-21)
- ✅ coverPath em normalizeTracks
- ✅ Webamp container 470x350px

### Correções Rodada 2 (2026-03-21)
- ✅ audio_path null para uploads de pastas
- ✅ Retry automático no player

### Correções Rodada 1 (2026-03-21)
- ✅ cleanup-grooveflix (Edge Function)
- ✅ grooveflix-delete (Edge Function)
- ✅ 404 handling no frontend

---

## Estado Atual (2026-03-22)

### ✅ Feito
- [x] Discogs Integration completa
- [x] Super Card pré-preenche metadados do Discogs
- [x] Cover image em alta resolução (via `uri`)
- [x] JIT Playlist implementado (hydrate on demand)
- [x] Swiper com dimensões fixas
- [x] Image proxy para CORS
- [x] Path organizado por usuário
- [x] All 62 tests passing

### 🔄 Fluxo Completo
1. Upload → `b2-upload-url` → B2 Native API
2. Visualizar cover → `b2-presign` → URL com `?Authorization=` → `<img>`
3. Tocar áudio → `b2-presign` → URL com `?Authorization=` → Webamp
4. Import Discogs → busca → preview → import → SuperCard exibe

### ⚠️ Observações
- Bucket B2 privado, usa signed URLs
- Discogs: `uri` para alta resolução, `uri150` para thumbnails
- Webamp v2.2.0 com skin base-2.91.wsz

---

## Variáveis de Ambiente

```
VITE_SUPABASE_URL=https://hlfirfukbrisfpebaaur.supabase.co
VITE_SUPABASE_ANON_KEY=...
B2_KEY_ID=...
B2_APPLICATION_KEY=...
CLOUDFLARE_API_TOKEN=cfut_HES0PZBEdFw7KyIgZalxedoSAoSMnSgV0AMSvMe720089df8
```

---

## Contatos Técnicos

- **Supabase:** https://supabase.com/dashboard/project/hlfirfukbrisfpebaaur
- **Cloudflare:** https://dash.cloudflare.com
- **B2:** https://www.backblaze.com/b2/cloud-storage.html
- **Discogs API:** https://www.discogs.com/developers

---

*Última atualização: 2026-03-23 21:00 UTC-3*

---

## Anotações de Debug

### Testar Image Proxy
```bash
curl "https://hlfirfukbrisfpebaaur.supabase.co/functions/v1/discogs-search/image-proxy?url=URL_ENCODED" \
  -H "Authorization: Bearer $ANON_KEY"
```

### Testar B2 Presign
```javascript
// No browser console:
const { data } = await supabase.functions.invoke('b2-presign', {
  body: { file_path: 'grooveflix/audio/user_xxx/...', userId: 'xxx', type: 'audio' }
});
console.log(data.url);
```

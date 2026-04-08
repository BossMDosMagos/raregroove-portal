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
│   │   ├── SuperAudioPlayer.jsx     # Player Hi-Fi com VU Meter
│   │   ├── VUMeter.jsx              # VU Meter analógico com RMS
│   │   ├── GrooveflixRow.jsx       # Cards de álbum com covers
│   │   ├── GrooveflixUploader.jsx   # Upload de álbuns
│   │   ├── GrooveflixPlayer.jsx     # Player de áudio
│   │   ├── DiscogsImporter.jsx      # Busca e importação do Discogs
│   │   ├── GlobalAudioPlayer.jsx    # Webamp player com JIT
│   │   └── ...
│   ├── hooks/
│   │   └── useSuperPlayer.js       # Web Audio API com FFT/RMS
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
├── public/images/vu/
│   ├── vu-l.png          # Background VU esquerdo
│   ├── vu-r.png          # Background VU direito
│   └── vu metter.png     # Original (referência)
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

## SuperAudioPlayer - Player com VU Meter

### Visão Geral
Player Hi-Fi com VU Meter analógico usando Web Audio API, física de agulha com balística RMS e LED de pico.

### Arquivos
- **Player:** `src/components/SuperAudioPlayer.jsx`
- **VU Meter:** `src/components/VUMeter.jsx`
- **Hook:** `src/hooks/useSuperPlayer.js`

### Audio Engine (useSuperPlayer)
```javascript
// getFloatTimeDomainData para RMS
const timeData = new Float32Array(analyser.fftSize);
analyser.getFloatTimeDomainData(timeData);
setTimeDomainData(new Float32Array(timeData));

// FFT para espectro (futuro EQ visual)
const freqData = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteFrequencyData(freqData);
setAnalyserData(new Uint8Array(freqData));
```

### VU Meter - Motor RMS

#### Fórmula de Balística McIntosh
```javascript
// Loop sumSquares para RMS real
const calculateRMS = (data) => {
  let sumSquares = 0.0;
  for (let i = 0; i < data.length; i++) {
    sumSquares += data[i] * data[i];
  }
  return Math.sqrt(sumSquares / data.length);
};

// Sensibilidade logarítmica (vida nos volumes baixos)
const applyLogCurve = (rms, curve = 2.5) => {
  if (rms <= 0) return 0;
  return Math.pow(rms, 1 / curve);
};

// Balística de Agulha
const ATTACK_FACTOR = 0.25;  // Sobe rápido
const DECAY_FACTOR = 0.06;   // Cai devagar

const targetLevel = applyLogCurve(leftRms, 2.5) * sliderGain * 100;
const factor = (targetLevel > currentLevel) ? ATTACK_FACTOR : DECAY_FACTOR;
currentLevel += (targetLevel - currentLevel) * factor;
```

#### LED de Pico
```javascript
// Pico usa Math.max absoluto, diferente do RMS
let leftPeak = 0;
for (let i = 0; i < leftData.length; i++) {
  if (Math.abs(leftData[i]) > leftPeak) leftPeak = Math.abs(leftData[i]);
}

// Acende quando > threshold 0.7
const peakThreshold = 0.7;
const leftLedBrightness = leftPeak > peakThreshold ? 
  Math.min(1, (leftPeak - peakThreshold) / 0.3) : 0;
```

### Calibração (localStorage)
```javascript
const defaults = {
  zeroOffset: -55,      // Posição zero da agulha (graus)
  inputGain: 1,        // Multiplicador RMS (0.1 - 5.0)
  damping: 0.18,       // Suavidade adicional da agulha
  needleBase: 0,       // Ajuste vertical da base
  amplitudeRange: 1.0, // Amplitude do arco (30% - 150%)
};

// Salvo em localStorage key: 'raregroove_vu_calibration'
```

### Imagens de Fundo
- **Pasta:** `public/images/vu/`
- **Arquivos:** `vu-l.png` (164x86), `vu-r.png` (164x86)
- Carregadas via `new Image()` e desenhadas com `ctx.drawImage()`

### Controles de Calibração
| Slider | Range | Função |
|--------|-------|--------|
| Zero Offset | -65° a -45° | Posição do zero (repouso) |
| Input Gain | 0.1× a 5.0× | Sensibilidade RMS |
| Damping | 0.05 a 0.50 | Suavidade adicional |
| Range | 30% a 150% | Amplitude do arco |
| Base Position | -5px a 10px | Ajuste vertical |

### Comportamento Esperado
- **Agulha:** Sobe rápido (0.25), cai devagar (0.06) - gravidade
- **LED PK:** Acende vermelho quando pico > 70% do máximo
- **Sem som:** Agulha volta suavemente ao zero

---

## WiiFlow - Player Visual (CoverFlow3D)

### Visão Geral
Carrossel 3D estilo Wii com player nativo integrado. Interface principal do Grooveflix com visual Premium e funcionalidades completas.

### Arquivo
- **Componente:** `src/components/CoverFlow3D.jsx`

### Funcionalidades Implementadas

#### 1. Super Card (Modal de Álbum)
- Botão "VER DETALHES" abaixo da capa central abre modal
- Exibe: título, artista, ano, país, labels, gênero, formato
- Notas (description) do Discogs
- Tracklist completa com scroll interno
- Botão "Ouvir Álbum" para reprodução
- z-index 99999 para garantir abertura
- Proteção contra erros em dados undefined/null

#### 2. Playlist com Seleção Individual
- Cada faixa é botão clicável
- Highlight da faixa ativa (borda dourada + bg yellow/30)
- Animação de equalizer para faixa em reprodução
- Reprodução direta ao clicar na faixa

#### 3. Álbuns Multi-Disco
- Parse da posição Discogs: "1-1", "2-3" → discNumber + trackNumber
- Agrupamento por disco com cabeçalhos "CD 1", "CD 2"
- Numeração correta de faixas por CD
- "(X discos)" exibido no header quando multi-disco
- Ordenação: disco → número da faixa

#### 4. Tracklist Completa
- Todas as faixas visíveis com scroll interno (max-h-64 no modal)
- Ordenação cronológica por disc_number + track_number
- Proteção com Array.isArray() para evitar erros

#### 5. Imagens e Placeholder
- Proxy de imagem via Edge Function discogs-search
- Placeholder SVG de luxo (vinil preto com detalhes dourados)
- Fallback automático quando proxy falha

#### 6. CD Rotating Animation (REMOVIDA)
- Animação de CD girando foi removida completamente
- Não há mais overlay sobre a capa central

### Proteção de Dados
```javascript
const rawTracklist = Array.isArray(grooveflixData.tracklist) ? grooveflixData.tracklist : [];
const audioFiles = Array.isArray(grooveflixData.audio_files) ? grooveflixData.audio_files : [];
const sortedTracklist = Array.isArray(rawTracklist) ? [...rawTracklist].sort(...) : [];
const groupedTracks = sortedTracklist.reduce((acc, track) => {...}, {});
const discKeys = Object.keys(groupedTracks || {}).sort(...);
```

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

## Status Atual (2026-03-24)

### ✅ VU METER COM BALÍSTICA McINTOSH - IMPLEMENTADO

**Motor RMS:**
- `getFloatTimeDomainData` para captura de onda real
- Loop `sumSquares`: `rms = sqrt(Σsample² / N)`
- Sensibilidade logarítmica: `pow(rms, 1/2.5)` para vida nos graves

**Balística de Agulha:**
- ATAQUE_RÁPIDO = 0.25: agulha sobe veloz com o som
- DECAIMENTO_SUAVE = 0.06: agulha cai devagar (gravidade)
- Factor dinâmico baseado na direção do movimento

**LED de Pico:**
- Usa `Math.max(abs(data))` para pico real
- Acende quando > threshold 0.7
- Brilho proporcional ao excesso

**Imagens de Fundo:**
- `vu-l.png` e `vu-r.png` em `public/images/vu/`
- Carregadas via refs para animação suave

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

*Última atualização: 2026-03-30 08:15 UTC-3*

---

## Arquitetura de Áudio 3.0 (GrooveflixPlayer)

### Visão Geral
Sistema de áudio integrado que conecta o player de streaming com visualizadores VU Meter, Woofer e Spectrum usando Web Audio API através do Howler.js.

### Arquivos Principais
- **Player Integrado:** `src/hooks/useGrooveflixPlayer.js`
- **Singleton de Analysers:** `src/hooks/useGlobalAudioAnalyser.js`
- **Engine de Áudio:** `src/hooks/useAudioEngine.js`
- **Contexto de Estado:** `src/contexts/AudioPlayerContext.jsx`

### Fluxo de Reprodução
1. `CoverFlow3D` chama `playAlbum()` do `useGrooveflixPlayer`
2. `AudioPlayerContext.playAlbum()` expande tracks e define `currentTrack`
3. Effect em `Grooveflix.jsx` detecta mudança de `currentTrack`
4. `loadAndPlayTrack()` busca presigned URL via `getPresignedUrl()`
5. `Howl` carrega o áudio com `html5: false` (Web Audio API)
6. No callback `onload`, `connectAnalysers()` conecta os nós de análise
7. No callback `onplay`, inicia o loop de animação dos visualizadores

### Conexão dos Analysers
```
Howler.masterGain → ChannelSplitter(2)
                            ↓
              ┌─────────────┴─────────────┐
              ↓                           ↓
        AnalyserL                    AnalyserR
        (FFT 4096)                  (FFT 4096)
              ↓                           ↓
        ChannelMerger(2) → destination
```

### Hooks de Visualização
Todos usam `useGlobalAudioAnalyser()` para acessar dados:
- **VUMeterLeft/Right:** `getRMS()` para nível RMS esquerdo/direito
- **VirtualWooferLeft/Right:** `getBassEnergy()` para frequências 0-60Hz
- **SpectrumLeft/Right:** `getWaveform()` para waveform stereo

### Problemas Corrigidos
1. **VUs travados no máximo:** Conectar analysers no `onload` (não no `onplay`)
2. **Memória vazando (3000+ frames):** Um único `animFrameId` com cancel antes do loop
3. **ctx.state === "closed":** `ensureContextRunning()` faz resume() antes de ler dados

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

---

## Novas Implementações (2026-04-01)

### ✅ LCD Display com Fonte Dot-Matrix

**Arquivos:**
- `src/components/LCDDisplay.jsx`
- `public/fonts/5x7-dot-matrix.otf`

**Features:**
- Fonte 5x7-dot-matrix customizada
- Bounds fixados: top: 5, right: 48, bottom: 10, left: 48
- Marquee contínuo para título da faixa
- Exibe: linha 1 (título), linha 2 (artista), linha 3 (faixarolante), linha 4 (duração)

**Fallback:**
- Quando nenhuma faixa tocando, exibe "GROOVEFLIX HI-FI"

### ✅ VirtualWoofer com Física MSD

**Arquivos:**
- `src/components/VirtualWoofer.jsx`

**Features:**
- Física Mass-Spring-Damper (v2)
- Transient detection para impactos
- Motion blur para movimento
- Perspectiva 3D do cone
- Presets: Sub/EDM, Hi-Fi, Studio, Rock/MPB

### ✅ Auto-Next Track

**Implementação:**
- `useGrooveflixPlayer.js` detecta evento `ended` do áudio
- Automaticamente toca próxima faixa da queue
- Continua até a última faixa do álbum

### ✅ Equalizador de 10 Bandas

**Arquivos:**
- `src/components/EqualizerPanel.jsx`
- `src/hooks/useEqualizer.js`

**Features:**
- 10 bandas: 32Hz, 64Hz, 125Hz, 250Hz, 500Hz, 1KHz, 2KHz, 4KHz, 8KHz, 16KHz
- Sliders arrastáveis com mouse
- Visual "black piano" com efeito de fibra de carbono
- LEDs verdes brilhantes (5px) no centro de cada knob
- LEDs desligam quando equalizador está OFF
- Presets em dropdown: Flat, Rock, Pop, Jazz, Clássico, EDM, Hip-Hop, Acústico, Vocal, Bass Boost

**Integração com Áudio:**
- Filtros Biquad Peaking EQ no grafo Web Audio
- merger → filtros → gain → destination

### ✅ Barra de Progresso

**Arquivo:**
- `src/components/ProgressBar.jsx`

**Features:**
- Posicionada abaixo do LCD Display
- Gradiente cyan → fuchsia com sombra brilhante
- Tempo atual / duração total em fonte monospace
- Clicável para seek
- Z-index máximo (99999) para visibilidade

---

## Otimizações de Performance (2026-04-02)

### Memory Leaks Corrigidos
- **CoverFlow3D**: Blob URLs revocados com `URL.revokeObjectURL()`
- **useGrooveflixPlayer**: Event listeners limpos corretamente

### Imports e Variáveis
- Removidos: `Film`, `Music`, `Disc`, `useSubscription`, `isTrialing`, `isActive`
- Removidos: `localIsPlaying`, `handleAlbumClick`, `isConnectedRef`, `console.log`

### React.memo Adicionado
- `DraggableSlider`
- `LCDDisplay`
- `ProgressBar`

### useMemo/useCallback Otimizados
- `sortedTracklist`, `visibleItems`, `filteredItems`, `textStyle`
- Dependências de callbacks corrigidas

### Código Limpo
- Estilos CSS movidos para `index.css`
- Componente `CrownSvg` extraído
- `panelStyle` constante extraída
- **529 linhas removidas, 241 adicionadas**

---

## Próximos Passos

- [ ] Testar equalizador em reprodução real
- [ ] Ajustar valores de preset se necessário
- [ ] Testar barra de progresso com seek
- [ ] Considerar visualização de espectro em tempo real

---

## Discogs Price Suggestions (2026-04-08)

### Objetivo
Buscar preços reais do Discogs para sugerir preços aos vendedores. Conversão USD/EUR → BRL com arredondamento psicológico.

### Arquivos
- `src/utils/currency.js` - Conversão de câmbio e arredondamento
- `src/components/DiscogsSearch.jsx` - Busca lowest_price real da API
- `src/components/AddItemModal.jsx` - Formulário com sugestões de preço

### currency.js
```javascript
// AwesomeAPI para taxa de câmbio
const response = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL');
const rates = await response.json();
const USD = parseFloat(rates.USDBRL?.bid);
const EUR = parseFloat(rates.EURBRL?.bid);

// Arredondamento psicológico
const psychologicalRound = (value) => {
  if (value < 20) return Math.ceil(value);
  if (value < 50) return Math.ceil(value / 2) * 2;
  if (value < 100) return Math.ceil(value / 5) * 5;
  return Math.ceil(value / 10) * 10;
};
```

### Discogs API - Release Stats
Endpoint: `/marketplace/stats/{release_id}` retorna:
```javascript
{
  lowest_price: { currency: "USD", value: 25.00 },
  num_for_sale: 5
}
```

### Fallback Protocol (ITEM RARO / SEM HISTÓRICO)
Quando não há dados de preço no Discogs:
- CD Simples: R$ 25,00
- CD Duplo / Digipack: R$ 45,00
- Box Set / Deluxe Edition: R$ 85,00

### Links de Pesquisa
Quando ITEM RARO:
- **Google:** `https://www.google.com/search?q={artista} {album} cd preço`
- **Mercado Livre:** `https://lista.mercadolivre.com.br/{artista} {album} cd`

Lógica de query:
```javascript
const rawTerm = `${artist} ${album}`.trim();
const cleanTerm = rawTerm.replace(/cd/gi, '').trim().replace(/\s+/g, ' ');
const finalQuery = cleanTerm ? `${cleanTerm} cd` : 'cd';
```

### Condição do Item
Multiplicadores sobre o preço base:
- MINT: +40%
- NM (Near Mint): +20%
- VG+ (Very Good Plus): +10%
- VG (Very Good): base

### Preço Mínimo
Floor de R$ 15,90 para itens com valor de mercado muito baixo.

---

## Grooveflix Player Fix (2026-04-08)

### Problema
Erro: `HTMLMediaElement already connected previously to a different MediaElementSourceNode`

### Causa
`connectMediaSource()` era chamado no evento `onPlay`, mas o elemento já estava conectado de uma chamada anterior.

### Solução
- `connectedAudioRef`: tracking de qual elemento foi conectado
- `connectMediaSource()` desconecta source anterior antes de criar novo
- Conexão feita uma única vez quando áudio é carregado

```javascript
const connectMediaSource = useCallback((audioElement) => {
  if (!audioElement || connectedAudioRef.current === audioElement) return false;
  
  if (mediaSourceRef.current) {
    mediaSourceRef.current.disconnect();
  }
  
  mediaSourceRef.current = ctx.createMediaElementSource(audioElement);
  connectedAudioRef.current = audioElement;
  isConnectedRef.current = true;
  connectAudioGraph();
  return true;
}, []);
```

---

## Barcode Diamond System (2026-04-08) ✅ IMPLEMENTADO

### Objetivo
Rastreamento de autenticidade via código de barras com visual "diamante" premium. **100% AUTOMÁTICO** - o usuário NÃO digita nada.

### Fluxo Automatizado
1. **Busca Discogs** → Usuário seleciona disco
2. **Extração Automática** → Barcode extraído de `identifiers` (type: Barcode/UPC/EAN)
3. **Preenchimento Automático** → `formData.barcode` populado sem input manual
4. **Salvamento Automático** → Ao clicar "Salvar", barcode vai para Supabase
5. **Exibição Diamond** → No catálogo, selo visual clicável leva ao Discogs

### Status: PRODUÇÃO
- ✅ Migração executada via Supabase Management API
- ✅ Coluna `barcode` (text) criada na tabela `items`
- ✅ Índice `idx_items_barcode` criado
- ✅ Componente visual implementado
- ✅ Extração do Discogs funcionando
- ✅ Salvamento automático no formulário
- ✅ Exibição no catálogo (ItemCard)

### Arquivos
- `src/components/BarcodeTag.jsx` - Componente visual diamante
- `src/components/DiscogsSearch.jsx` - Extração automática de barcode
- `src/components/AddItemModal.jsx` - Salvamento automático (sem input manual)
- `src/components/ItemCard.jsx` - Exibição no catálogo
- `supabase/migrations/20260408000000_add_barcode_to_items.sql` - Coluna no banco

### Extração do Barcode (DiscogsSearch)
```javascript
// Extrair barcode dos identifiers ou campo direto
let barcode = fullDetails?.barcode || null;
if (!barcode && fullDetails?.identifiers) {
  const barcodeEntry = fullDetails.identifiers.find(
    (id) => id.type === 'Barcode' || id.type === 'UPC' || id.type === 'EAN'
  );
  barcode = barcodeEntry?.value || null;
}
// Passa automaticamente no onImport()
onImport({ ..., barcode });
```

### Estrutura no Banco
```sql
-- Coluna na tabela items
ALTER TABLE public.items ADD COLUMN barcode text;

-- Índice para busca
CREATE INDEX idx_items_barcode ON public.items(barcode);
```

### Visual Diamond
- Ícone SVG de código de barras estilizado
- Gradiente cyan → blue → purple
- Hover: glow dourado + scale 1.1 + tooltips
- Animação de fade-in no tooltip
- Ícone Gem (diamante)

### Tooltip
```
💎 Autenticidade Garantida
Ver histórico oficial no Discogs
```

### Link Dinâmico
```
https://www.discogs.com/search/?q={barcode}&type=release
```

### Fallback (Cadastro Manual)
Sem barcode = etiqueta "Classic Edition" estática
- Ícone Gem (diamante)
- Cor âmbar/dourada
- Sem link clicável

### Funcionalidades
- Copiar barcode para clipboard (ao clicar)
- Feedback visual "Copiado!"
- Tooltip elegante com sombra
- Suporte a tamanhos sm/md

---

## Credenciais Supabase (Armazenadas)

### Access Token
- Formato: `sbp_xxx`
- Usado para: Supabase CLI, Management API
- Renovar em: https://supabase.com/dashboard/account/tokens

### Service Role Key
- Usado para: Edge Functions (não exposto no frontend)
- JWT com role: `service_role`

---

*Última atualização: 2026-04-08 13:10 UTC-3*

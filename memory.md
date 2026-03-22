# RareGroove Portal - Memória do Projeto

## Objetivo
Portal de streaming de música Hi-Fi com integração Discogs para importação automática de metadados.

## Funcionalidades Implementadas

### Discogs Integration
- **Edge Function** `discogs-search` - API proxy para Discogs
- **DiscogsImporter** - Modal de busca e importação de álbuns
- **DiscogsContext** - Estado global para dados importados
- Importação automática: título, artista, ano, gênero, capa (alta resolução), tracklist, gravadora, catálogo

### Super Card (GrooveflixUploader)
- Pré-preenchimento de metadados após importação Discogs
- Exibição de capa em alta resolução (via `uri` do Discogs)
- Sync de dados via props no DiscogsSearchModal
- useEffect observa `showDiscogsModal` para garantir atualização da capa

### JIT Playlist (Hydration on Demand)
- AudioPlayerContext implementa streaming sob demanda
- URLs de áudio buscadas apenas quando Webamp solicita (`onTrackDidChange`)
- Cache de URLs em `urlCacheRef` para evitar re-busca
- Limite de 1 download por vez com `hydratingRef`

### UI Fixes
- Swiper com dimensões fixas (200px altura nos cards)
- Cards com `max-height` para evitar expansão gigante

## Estrutura de Arquivos Importantes

```
src/
├── components/
│   ├── DiscogsImporter.jsx    # Busca e importação do Discogs
│   ├── GrooveflixUploader.jsx  # Upload com Super Card
│   ├── GlobalAudioPlayer.jsx   # Webamp player com JIT
│   └── GrooveflixRow.jsx       # Linhas de álbuns
├── contexts/
│   ├── DiscogsContext.jsx      # Estado global Discogs
│   └── AudioPlayerContext.jsx  # Player com JIT playlist
└── pages/
    └── Grooveflix.jsx          # Página principal

supabase/functions/
├── discogs-search/index.ts     # Edge function Discogs API
└── b2-presign/index.ts        # Presigned URLs B2
```

## Fluxo de Importação Discogs
1. Usuário clica "Buscar Discogs" → abre DiscogsImporter modal
2. Busca álbum → seleciona resultado → vê preview com tracklist
3. Clica "Importar Dados" → dados salvos no DiscogsContext
4. Modal fecha → DiscogsSearchModal sincroniza metadata via props
5. SuperCard exibe capa em alta resolução (`uri`) com fallback para `uri150`

## Bugs/Fixos Resolvidos
- Cover image não carregava → sync via props no modal
- Thumbnail usado ao invés de alta resolução → priorizado `uri`
- Swiper cards expandiam para tela inteira → dimensões fixas
- Audio player crashava → GrooveflixPlayerContext removido

## Comandos Úteis
```bash
npm run build    # Build produção
npm run dev      # Dev server
npm test         # Rodar testes
```

## Status: EM DESENVOLVIMENTO
- Discogs: ✅ Funcional
- JIT Playlist: ✅ Implementado
- UI Streaming: ✅ Funcional
- Testes E2E: ⏳ Pendente

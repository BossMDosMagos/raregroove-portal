# RareGroove Portal - Memória do Projeto

## Visão Geral
Marketplace de CDs e Vinil raros com sistema de escrow. Tech stack: React + Vite + Supabase + Backblaze B2 + Cloudflare Pages.

## Repositório
- GitHub: https://github.com/BossMDosMagos/raregroove-portal
- Produção: https://portalraregroove.com

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

### Correções Implementadas (2026-03-20)

#### 1. cleanup-grooveflix (Edge Function)
- Verifica se cada arquivo no banco existe no B2
- Remove paths órfãos do banco
- Deployada em: `https://hlfirfukbrisfpebaaur.supabase.co/functions/v1/cleanup-grooveflix`

#### 2. grooveflix-delete (Edge Function)
- Busca todos os arquivos associados ao item
- Deleta do B2 primeiro
- Deleta do banco depois
- Deployada em: `https://hlfirfukbrisfpebaaur.supabase.co/functions/v1/grooveflix-delete`

#### 3. Frontend (GrooveflixRow.jsx)
- Adicionado `failedCovers` state para tracking
- `onError` na imagem agora adiciona ID ao `failedCovers`
- Se `failedCovers.has(item.id)`, mostra placeholder
- Corrigido bug: `getSession()` é async

#### 4. Upload (GrooveflixUploader.jsx)
- Logs detalhados no console para debug
- Não salva `blob:` URL se upload falhar

#### 5. b2-presign (Edge Function) - 2026-03-20 09:13
- Adicionado parâmetro `type: 'cover'` para capas públicas
- Capas não requerem autenticação (acesso livre)
- Áudios ainda requerem assinatura ativa

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

## Estado Atual (2026-03-20 09:13)

### ✅ Feito
- [x] Edge Function `cleanup-grooveflix` criada e deployada
- [x] Edge Function `grooveflix-delete` criada e deployada
- [x] 404 handling no frontend (GrooveflixRow.jsx)
- [x] Logs de debug no uploader
- [x] Bug `getSession()` corrigido
- [x] Capas públicas via `b2-presign` (type='cover')
- [x] Edge Function `b2-presign` deployada
- [x] Build OK

### 🔄 Pendente
- [ ] Deploy frontend para Cloudflare Pages
- [ ] Testar exibição de capas
- [ ] Testar cleanup dos registros
- [ ] Testar delete seguro

### ⚠️ Observações
- Bucket B2 está privado, precisa de signed URLs
- Capas agora são públicas (não requerem login)
- Áudios ainda requerem assinatura ativa

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

## Próximos Passos

1. **Verificar deploy** - Aguardar Cloudflare Pages atualizar
2. **Testar UI** - Abrir portalraregroove.com/grooveflix
3. **Executar cleanup** - POST para cleanup-grooveflix
4. **Testar delete** - Botão de excluir deve funcionar

---

## Contatos Técnicos

- **Supabase:** https://supabase.com/dashboard/project/hlfirfukbrisfpebaaur
- **Cloudflare:** https://dash.cloudflare.com
- **B2:** https://www.backblaze.com/b2/cloud-storage.html

---

*Última atualização: 2026-03-20 09:13 UTC-3*

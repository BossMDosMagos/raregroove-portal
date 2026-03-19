# RareGroove - Memória do Projeto

> **⚠️ IMPORTANTE:** Este arquivo é a memória do projeto. Leia SEMPRE antes de começar a trabalhar.
> Atualize quando houver mudanças significativas.

---

## IDENTIDADE DO PROJETO

**Nome:** RareGroove (RareGroove 3.0)  
**URL Production:** https://raregroove.com  
**URL Staging:** https://staging.raregroove.com  
**GitHub:** https://github.com/RareGroove/raregroove-3.0

**Stack:**
- Frontend: React 19 + Vite + Tailwind CSS 4
- Backend: Supabase (Edge Functions + PostgreSQL + RLS)
- Storage: Backblaze B2 (bucket: **Cofre-RareGroove-01**)
- Deploy: Cloudflare Pages
- Pagamentos: Stripe, Mercado Pago, PayPal

---

## STACK TÉCNICA

### Frontend (Vite + React 19)
- `src/App.jsx` - Router principal
- `src/lib/supabase.js` - Cliente Supabase
- `src/contexts/` - Contextos (SubscriptionContext, I18nContext, CartContext)
- `src/pages/` - Páginas (32 páginas, admin e pública)
- `src/components/` - Componentes reutilizáveis

### Backend (Supabase)
- **Edge Functions em:** `supabase/functions/`
- **Migrations em:** `supabase/migrations/` (55 arquivos)
- **Tabelas principais:** profiles, items, subscriptions, swaps, disputes, escrow, notifications

### CI/CD (GitHub Actions)
- `.github/workflows/ci.yml` - Pipeline completo
- Deploy para Cloudflare Pages via `cloudflare/pages-action`

---

## CONFIGURAÇÕES SENSÍVEIS

### GitHub Secrets (REQUIRED)
```
VITE_SUPABASE_URL=https://hlfirfukbrisfpebaaur.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsZmlyZnVrYnJpc2ZwZWJhYXVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNzIwNTUsImV4cCI6MjA4Njg0ODA1NX0.vXadY-YLsKGuWXEb2UmHAqoDEx0vD_FpFkrTs55CiuU
VITE_STRIPE_PUBLISHABLE_KEY
VITE_MP_PUBLIC_KEY
VITE_PAYPAL_CLIENT_ID

CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_ZONE_ID

SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_ID=hlfirfukbrisfpebaaur

CODECOV_TOKEN
DISCORD_WEBHOOK_ID
DISCORD_WEBHOOK_SECRET
```

### Supabase Edge Function Secrets (Configurar via `supabase secrets`)
```
B2_KEY_ID=        # Backblaze B2 Key ID
B2_APPLICATION_KEY= # Backblaze B2 Application Key
B2_BUCKET_NAME=Cofre-RareGroove-01
```

### Cloudflare Pages Environment Variables
```
B2_KEY_ID
B2_APPLICATION_KEY
B2_BUCKET_NAME=Cofre-RareGroove-01
```

---

## REGRAS DE NEGÓCIO CRÍTICAS

### 1. Sistema de Assinaturas com BYPASS ADMIN
```sql
-- Migration: 052_grooveflix_admin_bypass.sql
-- Admin (is_admin = true) SEMPRE tem acesso ao Grooveflix sem assinatura
-- Função: check_grooveflix_access() retorna { allowed: true, is_admin: true }
```

**Admin User:**
- Email: `raregroovecdseswapsafe@gmail.com`
- `is_admin = true`
- `user_level = 99`
- `subscription_status = 'active'`

### 2. Upload de Áudio para Backblaze B2
```
Fluxo: Frontend → Supabase Edge Function (b2-upload-url) → Backblaze B2
Bucket: Cofre-RareGroove-01
Permissão: Apenas admins podem fazer upload (verificado via service role bypass)
```

**Edge Function:** `supabase/functions/b2-upload-url/index.ts`
- Verifica admin via service role (bypass total de RLS)
- Retorna URL de upload do B2
- O upload direto vai para o B2

### 3. Sistema de Pagamentos
- **Stripe:** Assinaturas + Checkout
- **Mercado Pago:** Checkout para BR
- **PayPal:** Checkout internacional

### 4. Grooveflix (Streaming de CDs)
- Player de áudio Hi-Fi
- Categorias: single, album, coletanea, iso
- Armazenamento: Backblaze B2
- Preview com qualidade limitada para trial

---

## ESTRUTURA DE DEPLOY

```
push to main
    ↓
GitHub Actions CI
    ├── lint (ESLint)
    ├── typecheck (TypeScript)
    ├── test (Vitest)
    └── e2e (Playwright)
         ↓
    Build (Vite)
         ↓
Deploy Cloudflare Pages (raregroove)
         ↓
Deploy Supabase Edge Functions
         ↓
Run Migrations
         ↓
Notify Discord
```

---

## DÍVIDAS TÉCNICAS / ISSUES ABERTOS

### CI/CD
- TypeScript check com `continue-on-error: true` (alguns erros esperados)
- Vitest com `continue-on-error: true` (pode ter falhas)
- E2E com `continue-on-error: true` (instable)

### B2 Upload
- O upload multipart está em `/api/b2-multipart/*` (Cloudflare Worker?)
- Documentação menciona CORS rules necessárias no Backblaze

### RLS (Row Level Security)
- Migration 055 corrigiu loop infinito de RLS
- Profiles agora são públicos para leitura
- Admin bypass via função RPC, não via RLS

---

## FUNÇÕES IMPORTANTES DO SUPABASE

```sql
-- Verificar acesso ao Grooveflix
SELECT * FROM check_grooveflix_access();
-- Retorna: { allowed, is_admin, reason }

-- Verificar se é admin
SELECT is_admin_user();
-- Retorna: true/false

-- Admin email para referência
'raregroovecdseswapsafe@gmail.com'
```

---

## EDGE FUNCTIONS DISPONÍVEIS

| Função | Propósito |
|--------|-----------|
| `b2-upload-url` | Gera URL de upload para Backblaze B2 |
| `b2-presign` | Presign URL para download |
| `stripe-create-payment-intent` | Cria Payment Intent Stripe |
| `stripe-webhook` | Webhook Stripe |
| `mp-create-preference` | Preference Mercado Pago |
| `paypal-create-order` | Order PayPal |
| `grooveflix-meter` | Metering de uso trial |
| `2fa-setup` | Configuração 2FA |

---

## PÁGINAS ADMIN

- `/admin` - Dashboard
- `/admin/users` - Gerenciar usuários
- `/admin/upload` - Upload operacional de CDs
- `/admin/subscriptions` - Assinaturas
- `/admin/sales` - Vendas
- `/admin/swaps` - Trocas
- `/admin/disputes` - Disputas
- `/admin/escrow-sla` - SLA de custódia
- `/admin/refunds` - Reembolsos
- `/admin/trash` - Lixeira

---

## ÚLTIMAS MODIFICAÇÕES

- **055_fix_rls_loop.sql**: Corrige loop de RLS, restaura perfil admin
- **052_grooveflix_admin_bypass.sql**: Implementa bypass admin para Grooveflix
- **GrooveflixUploader.jsx**: Upload via B2 com verificação admin
- **b2-upload-url/index.ts**: Edge function com service role bypass

## B2 UPLOAD - CONFIGURAÇÃO COMPLETA (19/03/2026)

### Secrets Configuradas no Supabase
```
B2_KEY_ID=6f3db4a31f57
B2_APPLICATION_KEY=0051415e496febb350d3fa134f57f7355dca6d91c1
B2_BUCKET_NAME=Cofre-RareGroove-01
```

### Bucket ID (hardcoded na função)
```
56cfb33d8ba45a4391cf0517
```

### CORS Configurado
```
allowedOrigins: https://portalraregroove.com, https://raregroove.com, https://staging.raregroove.com, http://localhost:5173
allowedOperations: s3_put, s3_get, s3_head
maxAgeSeconds: 3600
```

### Status: ✅ OPERACIONAL
- Edge Function: https://hlfirfukbrisfpebaaur.supabase.co/functions/v1/b2-upload-url
- Bucket: Cofre-RareGroove-01
- Upload funcionando via frontend Grooveflix

---

## NOTAS

- **Bucket B2:** `Cofre-RareGroove-01` (CRÍTICO - não mudar!)
- **Admin Email:** `raregroovecdseswapsafe@gmail.com`
- **Supabase Project ID:** `hlfirfukbrisfpebaaur`
- **CORS:** Configurar no Backblaze para permitir uploads do frontend

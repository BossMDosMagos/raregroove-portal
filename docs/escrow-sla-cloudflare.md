## Escrow SLA automático (Cloudflare)

Este projeto possui um módulo de SLA de custódia no Supabase (`run_escrow_sla`) que deve rodar periodicamente (ex: a cada 15 minutos) para:

- Marcar envio atrasado (2 dias) em `escrow_sla_events`
- Marcar entrega potencialmente atrasada (14 dias) em `escrow_sla_events`
- Abrir disputa automaticamente (30 dias sem entrega) e registrar evento

### Opção recomendada: Cloudflare Worker (cron trigger)

1) Instale Wrangler

```bash
npm i -g wrangler
```

2) Faça login no Cloudflare

```bash
wrangler login
```

3) Configure secrets do Worker

Na pasta `cloudflare/escrow-sla-runner`:

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put SUPABASE_URL
wrangler secret put MANUAL_TRIGGER_TOKEN
```

4) Ajuste o `SUPABASE_URL` no `wrangler.toml` (ou defina como secret e deixe vazio no arquivo).

5) Deploy

```bash
wrangler deploy
```

### Teste manual

Você pode disparar manualmente via HTTP (se `MANUAL_TRIGGER_TOKEN` estiver definido):

```bash
curl -X POST "https://<seu-worker>.workers.dev" -H "x-manual-token: <token>"
```

### Observações de segurança

- Use `SUPABASE_SERVICE_ROLE_KEY` apenas como secret no Cloudflare (nunca no frontend).
- Se não quiser endpoint manual, remova `MANUAL_TRIGGER_TOKEN` (o Worker aceitará POST sem autenticação).


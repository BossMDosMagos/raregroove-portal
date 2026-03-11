## Escrow SLA automático (Supabase)

Objetivo: rodar `public.run_escrow_sla()` automaticamente a cada 15 minutos dentro do Supabase.

### Por que assim é o mais prudente

- Não depende de Cloudflare/GitHub para automação.
- Não expõe `SUPABASE_SERVICE_ROLE_KEY` fora do Supabase.
- Zero chamadas HTTP: o cron roda SQL direto no Postgres.

### Como aplicar via CLI

1) Login e link do projeto

```bash
npx supabase login
npx supabase link --project-ref <SEU_PROJECT_REF>
```

2) Aplicar migrations (inclui o agendamento do cron)

```bash
npx supabase db push
```

### O que a migration faz

O arquivo `supabase/migrations/20260311176000_schedule_escrow_sla_cron.sql`:

- habilita `pg_cron` (se ainda não estiver)
- cria um job `escrow_sla_15m` (se não existir) com `*/15 * * * *`

### Verificar se está rodando (SQL)

No SQL Editor:

```sql
select * from cron.job where jobname = 'escrow_sla_15m';
select * from cron.job_run_details order by start_time desc limit 50;
```

### Rodar manualmente (SQL)

```sql
select public.run_escrow_sla();
```


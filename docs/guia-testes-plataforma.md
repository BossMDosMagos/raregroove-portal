## Guia de testes (plataforma) — Escrow + Disputas + SLA + Notificações

Este guia valida, ponta a ponta, as implementações de:

- Custódia (escrow) com envio/entrega e liberação de saldo
- Disputas (abertura, mensagens, evidências, resolução admin)
- SLA automático (2d envio, 14d alerta, 30d auto-disputa) via pg_cron
- Notificações (evento, disputa, mensagens, admin status/resolução)

### Pré-requisitos

- Você tem 3 contas reais:
  - **Admin** (perfil com `is_admin = true`)
  - **Vendedor**
  - **Comprador**
- Você consegue abrir 2 sessões simultâneas (ex.: navegador + janela anônima) para testar comprador/vendedor em paralelo.
- Migrations aplicadas no Supabase:
  - `20260311170000_escrow_core_functions.sql`
  - `20260311171000_disputes.sql`
  - `20260311172000_dispute_storage_bucket.sql`
  - `20260311173000_disputes_admin_rpcs.sql`
  - `20260311175000_escrow_sla.sql`
  - `20260311176000_schedule_escrow_sla_cron.sql`
  - `20260311180000_notifications_schema.sql`
  - `20260311181000_escrow_sla_notifications.sql`
  - `20260311182000_dispute_notifications_and_rules.sql`
  - `20260311183000_admin_dispute_notifications.sql`

### 1) Teste base: venda + envio + confirmação + liberação de saldo

1. Logue como **Vendedor**.
2. Crie um item para venda (preço baixo para teste).
3. Em outra sessão, logue como **Comprador**.
4. Compre o item normalmente e finalize o pagamento como você faz em produção.
5. Volte na sessão do **Vendedor**:
   - Vá em **Financeiro** → **Minhas Vendas**.
   - Na transação, clique em **ADICIONAR RASTREIO** e informe um código (qualquer texto).
   - Confirme que a transação fica com status **enviado** e exibe `shipped_at`.
6. Volte na sessão do **Comprador**:
   - Vá em **Financeiro** → **Minhas Compras**.
   - Na compra, clique em **Confirmar recebimento**.
7. Validações esperadas:
   - A compra/venda muda para **concluído**.
   - O saldo do vendedor aumenta (via `user_balances.available_balance`).

### 2) Teste de disputa manual (comprador abre)

1. Garanta uma transação no status **enviado** (da etapa 1, antes do “Confirmar recebimento”).
2. Na sessão do **Comprador**:
   - **Financeiro** → **Minhas Compras** → clique **ABRIR DISPUTA**.
3. Validações esperadas:
   - Você é redirecionado para `/disputas` e consegue entrar em `/disputas/<id>`.
   - O **Vendedor** recebe uma notificação “DISPUTA ABERTA”.
   - O **Admin** recebe notificação “NOVA DISPUTA”.

### 3) Teste de chat na disputa (notificação por mensagem)

1. Na sessão do **Comprador**, dentro de `/disputas/<id>`:
   - Envie uma mensagem (ex.: “Não recebi o item”).
2. Validação esperada:
   - O **Vendedor** recebe notificação “NOVA MENSAGEM NA DISPUTA”.
3. Na sessão do **Vendedor**, entre em `/disputas` → clique na disputa e responda.
4. Validação esperada:
   - O **Comprador** recebe notificação “NOVA MENSAGEM NA DISPUTA”.

### 4) Teste de evidência (upload + acesso)

1. Na tela `/disputas/<id>`, envie:
   - 1 imagem (JPG/PNG/WebP)
   - 1 PDF
2. Validações esperadas:
   - Os arquivos aparecem na lista de evidências.
   - Ao clicar, abre em nova aba (signed URL do bucket `dispute_evidence`).
   - Apenas comprador/vendedor/admin conseguem acessar.

### 5) Regra de bloqueio: confirmar entrega com disputa aberta

1. Com a disputa ainda em aberto, na sessão do **Comprador**:
   - volte para **Minhas Compras** e tente **Confirmar recebimento**.
2. Validação esperada:
   - Bloqueia com mensagem de que existe disputa em aberto.

### 6) Admin: triagem + mudança de status

1. Logue como **Admin**.
2. Acesse `/admin/disputes`.
3. Abra a disputa.
4. Altere o status (ex.: `under_review`).
5. Validações esperadas:
   - Comprador e vendedor recebem notificação “STATUS DA DISPUTA ATUALIZADO”.

### 7) Admin: resolver disputa (liberação ou reembolso)

**Cenário A — Liberar**
1. Em `/admin/disputes`, clique **Liberar**.
2. Validações esperadas:
   - Disputa vira `resolved_release`.
   - Transação vira `concluido`.
   - Saldo do vendedor é liberado (available sobe; pending desce).
   - Comprador e vendedor recebem notificação “DISPUTA RESOLVIDA”.

**Cenário B — Reembolsar**
1. Em uma disputa diferente, clique **Reembolsar**.
2. Validações esperadas:
   - Disputa vira `resolved_refund_pending` (reembolso aprovado, aguardando execução humana).
   - Transação vira `cancelado`.
   - Ledger registra `disputa_reembolso`.
   - Comprador e vendedor recebem notificação “REEMBOLSO APROVADO”.
3. Após fazer o reembolso fora do sistema (processo humano), no `/admin/disputes`:
   - clique **Marcar executado** na disputa.
4. Validações esperadas:
   - Disputa vira `resolved_refund`.
   - Comprador e vendedor recebem notificação “REEMBOLSO EXECUTADO”.

### 8) Regra de prazo: disputa até 7 dias após entrega (status concluído)

1. Escolha uma transação **concluída** de teste.
2. No Supabase SQL Editor, simule uma entrega antiga:

```sql
update public.transactions
set delivered_at = now() - interval '8 days'
where id = '<TRANSACTION_ID>';
```

3. Tente abrir disputa (comprador ou vendedor) para essa transação.
4. Validação esperada:
   - Bloqueia com “Prazo para abrir disputa expirado (7 dias)”.

### 9) SLA automático (sem esperar dias)

Você pode simular cada regra ajustando timestamps e rodando o SLA manualmente:

```sql
select public.run_escrow_sla();
```

**9.1) Envio atrasado (2 dias)**
1. Pegue uma transação `pago_em_custodia`/`pago` sem `shipped_at`.
2. No SQL Editor:

```sql
update public.transactions
set created_at = now() - interval '3 days'
where id = '<TRANSACTION_ID>';
select public.run_escrow_sla();
```

3. Validações:
   - cria evento `ship_overdue_2d` em `escrow_sla_events`
   - cria notificação pro vendedor “ENVIO ATRASADO (2 DIAS)”

**9.2) Entrega atrasada (14 dias)**
1. Transação em `enviado` com `shipped_at` preenchido.
2. No SQL Editor:

```sql
update public.transactions
set shipped_at = now() - interval '15 days'
where id = '<TRANSACTION_ID>';
select public.run_escrow_sla();
```

3. Validações:
   - cria evento `delivery_overdue_14d`
   - notifica comprador e vendedor “ENTREGA ATRASADA (14 DIAS)”

**9.3) Auto-disputa (30 dias)**
1. Transação em `enviado` com `shipped_at` antigo e sem disputa aberta.
2. No SQL Editor:

```sql
update public.transactions
set shipped_at = now() - interval '31 days'
where id = '<TRANSACTION_ID>';
select public.run_escrow_sla();
```

3. Validações:
   - cria evento `auto_dispute_30d` (com `metadata.dispute_id`)
   - cria disputa `under_review`
   - notifica comprador e vendedor “DISPUTA ABERTA AUTOMATICAMENTE”

### 10) Verificar cron rodando

No SQL Editor:

```sql
select * from cron.job where jobname = 'escrow_sla_15m';
select * from cron.job_run_details order by start_time desc limit 20;
```

## Blindagem de segurança (camadas)

Este projeto tem proteções em camadas para reduzir automações/bots e diminuir superfície de ataque no frontend.

### 1) Honeypot duplo + timing mínimo (anti-bot)

Aplicado em:

- Login/Signup: [Login.jsx](file:///c:/PROJETO-RAREGROOVE-3.0/src/pages/Auth/Login.jsx)
- Completar cadastro: [CompleteSignUp.jsx](file:///c:/PROJETO-RAREGROOVE-3.0/src/pages/Auth/CompleteSignUp.jsx)

Regras:

- Dois campos invisíveis devem ficar vazios.
- O envio do formulário é rejeitado se for rápido demais (tempo mínimo).

### 2) Timeout de login (anti-bruteforce local)

Em login:

- Backoff progressivo entre tentativas (até 20s).
- Lockout de 15 minutos após 5 falhas.

Implementação: [security.js](file:///c:/PROJETO-RAREGROOVE-3.0/src/utils/security.js)

### 3) Timeout por inatividade (auto sign-out)

Quando o usuário fica inativo, a sessão é encerrada automaticamente.

Configuração (opcional) via env:

- `VITE_SESSION_IDLE_TIMEOUT_MINUTES` (padrão: 30)
- `VITE_SESSION_IDLE_WARN_MINUTES` (padrão: 2)

Implementação: [App.jsx](file:///c:/PROJETO-RAREGROOVE-3.0/src/App.jsx)

### 4) Headers de segurança (CSP + anti-clickjacking)

Arquivo para Cloudflare Pages/Netlify:

- [public/_headers](file:///c:/PROJETO-RAREGROOVE-3.0/public/_headers)

Se algum provedor externo parar de funcionar (Stripe/PayPal), ajuste `script-src`, `frame-src` e `connect-src` no CSP.


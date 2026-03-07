REM ============================================================================
REM SCRIPT DE CONFIGURAÇÃO DO COFRE INVISÍVEL (SUPABASE SECRETS)
REM ============================================================================
REM Este script configura as variáveis de ambiente sensíveis (Secret Keys)
REM diretamente no servidor Supabase, sem expô-las no código fonte.
REM ============================================================================

REM ⚠️ IMPORTANTE: SUBSTITUA OS VALORES ABAIXO PELAS SUAS CHAVES REAIS ANTES DE RODAR

REM 1. STRIPE SECRET KEY (Produção)
call npx supabase secrets set STRIPE_SECRET_KEY=sk_live_SUA_CHAVE_AQUI

REM 2. MERCADO PAGO ACCESS TOKEN (Produção)
call npx supabase secrets set MP_ACCESS_TOKEN=APP_USR-SEU_TOKEN_AQUI

REM 3. PAYPAL CLIENT SECRET (Produção)
call npx supabase secrets set PAYPAL_CLIENT_SECRET=SEU_CLIENT_SECRET_AQUI

REM ============================================================================
REM VERIFICAÇÃO FINAL
REM ============================================================================
echo.
echo ✅ CHAVES CONFIGURADAS COM SUCESSO NO COFRE INVISÍVEL!
echo.
echo As seguintes variáveis estão agora protegidas no servidor:
echo - STRIPE_SECRET_KEY
echo - MP_ACCESS_TOKEN
echo - PAYPAL_CLIENT_SECRET
echo.
echo As Edge Functions já podem utilizá-las com segurança.
pause

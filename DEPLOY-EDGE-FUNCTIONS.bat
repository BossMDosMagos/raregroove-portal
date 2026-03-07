@echo off
REM Script para fazer deploy das Edge Functions com CORS corrigido
REM Autor: GitHub Copilot
REM Data: 2026-03-01

echo.
echo ============================================
echo  Deploy de Edge Functions - CORS Fix
echo ============================================
echo.

REM Tentar fazer login
echo [1] Autenticando no Supabase...
call npx supabase login --no-browser
if errorlevel 1 (
    echo.
    echo ERRO: Falha na autenticacao
    echo.
    echo Se o login falhar, use este comando em seu terminal (substituir TOKEN):
    echo set SUPABASE_ACCESS_TOKEN=seu_token_aqui
    echo.
    echo Para obter seu token:
    echo 1. Acesse: https://app.supabase.com
    echo 2. Clique no menu de usuario (canto superior direito)
    echo 3. Clique em "Access Tokens"
    echo 4. Gere um novo token
    echo 5. Copie o token
    echo.
    pause
    exit /b 1
)

echo.
echo [2] Fazendo deploy da funcao: mp-create-preference
call npx supabase functions deploy mp-create-preference --no-verify-jwt
echo.

echo [3] Fazendo deploy da funcao: stripe-create-payment-intent
call npx supabase functions deploy stripe-create-payment-intent
echo.

echo [4] Fazendo deploy da funcao: paypal-create-order
call npx supabase functions deploy paypal-create-order
echo.

echo [5] Fazendo deploy da funcao: paypal-capture-order
call npx supabase functions deploy paypal-capture-order
echo.

echo [6] Fazendo deploy da funcao: process-transaction
call npx supabase functions deploy process-transaction --no-verify-jwt
echo.

echo ============================================
echo  Deploy Completo!
echo ============================================
echo.
echo Proximo passo:
echo 1. Recarregue o navegador (CTRL+R)
echo 2. Volte ao Checkout
echo 3. Tente fazer um pagamento com Mercado Pago
echo.
pause

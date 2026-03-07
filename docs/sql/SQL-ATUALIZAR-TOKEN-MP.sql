-- ============================================
-- ATUALIZAR TOKEN DO MERCADO PAGO
-- ============================================
-- 
-- PASSO 1: Acesse https://www.mercadopago.com.br/developers/panel/app
-- PASSO 2: Selecione sua aplicação
-- PASSO 3: Vá em "Credenciais" > "Credenciais de produção"
-- PASSO 4: Copie o ACCESS TOKEN (começa com APP_USR-)
-- PASSO 5: Cole AQUI substituindo o texto 'COLE_SEU_TOKEN_AQUI'
-- PASSO 6: Execute esta SQL no Supabase

UPDATE platform_settings 
SET mp_access_token_production = 'APP_USR-1108094715244445-020709-fb00746919853f17ee071ac0f2a777f4-53063894'
WHERE id = 1;

-- Verificar se atualizou:
SELECT 
  LEFT(mp_access_token_production, 20) || '...' as token_atualizado,
  LENGTH(mp_access_token_production) as tamanho
FROM platform_settings 
WHERE id = 1;

-- O tamanho deve ser ~73 caracteres
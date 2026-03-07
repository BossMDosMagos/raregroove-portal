-- Verificar dados em user_addresses
SELECT id, user_id, full_name, address, city, state, cep, is_default, created_at
FROM user_addresses
ORDER BY created_at DESC
LIMIT 20;

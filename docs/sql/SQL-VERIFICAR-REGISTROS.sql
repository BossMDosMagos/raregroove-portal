-- Verificar se há ALGUM registro na tabela platform_settings
SELECT 
  COUNT(*) as "Total de Registros",
  STRING_AGG(id::text, ', ') as "IDs Existentes"
FROM platform_settings;

-- Se houver registros, mostrar todos
SELECT * FROM platform_settings ORDER BY id;

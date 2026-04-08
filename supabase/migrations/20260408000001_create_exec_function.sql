-- Criar função exec para executar SQL dinâmico
CREATE OR REPLACE FUNCTION exec(query TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE query;
END;
$$;

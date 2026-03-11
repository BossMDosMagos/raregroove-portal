-- Tabela para configurações dinâmicas do sistema (ex: Modo Manutenção)
CREATE TABLE IF NOT EXISTS system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Política: Todos podem ler (para verificar se site está off)
DROP POLICY IF EXISTS "Public read settings" ON system_settings;
CREATE POLICY "Public read settings" ON system_settings
  FOR SELECT USING (true);

-- Política: Apenas Admins podem alterar
DROP POLICY IF EXISTS "Admins update settings" ON system_settings;
CREATE POLICY "Admins update settings" ON system_settings
  FOR UPDATE USING (
    auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true)
  );

-- Inserir configuração inicial de manutenção (desativada)
INSERT INTO system_settings (key, value)
VALUES ('maintenance_mode', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

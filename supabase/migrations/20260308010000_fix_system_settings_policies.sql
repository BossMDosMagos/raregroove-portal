-- Correção de Permissões para Tabela de Configurações
-- Permite que Admins façam INSERT e UPDATE (necessário para o botão funcionar)

DROP POLICY IF EXISTS "Admins update settings" ON system_settings;
DROP POLICY IF EXISTS "Admins insert settings" ON system_settings;

-- Permite atualizar
CREATE POLICY "Admins update settings" ON system_settings
  FOR UPDATE USING (
    auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true)
  );

-- Permite inserir (caso a configuração ainda não exista)
CREATE POLICY "Admins insert settings" ON system_settings
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true)
  );

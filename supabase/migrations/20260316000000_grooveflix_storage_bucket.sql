-- Bucket para arquivos do Grooveflix (áudio, ISO, encartes)

-- Criar bucket se não existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 
  'grooveflix',
  'grooveflix-files',
  false,
  524288000,
  ARRAY['audio/mpeg', 'audio/flac', 'audio/wav', 'audio/x-wav', 'application/x-iso9660-image', 'application/pdf']
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'grooveflix');

-- Política: usuários autenticados podem fazer upload
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can upload to grooveflix' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can upload to grooveflix"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'grooveflix');
  END IF;
END $$;

-- Política: apenas dono pode acessar seus arquivos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own grooveflix files' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can view own grooveflix files"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'grooveflix');
  END IF;
END $$;

-- Política: apenas dono pode deletar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own grooveflix files' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can delete own grooveflix files"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'grooveflix');
  END IF;
END $$;

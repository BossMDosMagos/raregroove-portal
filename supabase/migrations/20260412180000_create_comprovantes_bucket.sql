-- Create bucket for PIX comprovantes
INSERT INTO storage.buckets (id, name, public, created_at, updated_at)
VALUES ('comprovantes', 'comprovantes', true, now(), now())
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload comprovantes
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'comprovantes');

-- Allow public read access to comprovantes
CREATE POLICY "Allow public read"
ON storage.objects
FOR SELECT
TO public, authenticated
USING (bucket_id = 'comprovantes');

-- Allow owner delete
CREATE POLICY "Allow owner delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (auth.uid() = owner);
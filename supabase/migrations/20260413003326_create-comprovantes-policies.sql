-- Create bucket for PIX comprovantes
INSERT INTO storage.buckets (id, name, public, created_at, updated_at)
VALUES ('comprovantes', 'comprovantes', true, now(), now())
ON CONFLICT (id) DO NOTHING;

-- Allow public INSERT/UPSERT to comprovantes bucket
DROP POLICY IF EXISTS "Allow public insert comprovantes" ON storage.objects;
CREATE POLICY "Allow public insert comprovantes"
ON storage.objects
FOR INSERT TO public
WITH CHECK (true);

-- Allow public SELECT to comprovantes bucket  
DROP POLICY IF EXISTS "Allow public select comprovantes" ON storage.objects;
CREATE POLICY "Allow public select comprovantes"
ON storage.objects
FOR SELECT TO public
USING (true);

-- Allow public UPDATE to comprovantes bucket
DROP POLICY IF EXISTS "Allow public update comprovantes" ON storage.objects;
CREATE POLICY "Allow public update comprovantes"
ON storage.objects
FOR UPDATE TO public
USING (true);

-- Allow public DELETE to comprovantes bucket
DROP POLICY IF EXISTS "Allow public delete comprovantes" ON storage.objects;
CREATE POLICY "Allow public delete comprovantes"
ON storage.objects
FOR DELETE TO public
USING (true);
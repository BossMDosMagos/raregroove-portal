DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'dispute_evidence'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('dispute_evidence', 'dispute_evidence', false);
  END IF;
END $$;

DROP POLICY IF EXISTS "Dispute evidence objects read" ON storage.objects;
CREATE POLICY "Dispute evidence objects read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'dispute_evidence'
  AND name LIKE 'disputes/%'
  AND EXISTS (
    SELECT 1
    FROM public.disputes d
    WHERE d.id::text = split_part(name, '/', 2)
      AND (
        d.buyer_id = auth.uid()
        OR d.seller_id = auth.uid()
        OR d.opened_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
      )
  )
);

DROP POLICY IF EXISTS "Dispute evidence objects insert" ON storage.objects;
CREATE POLICY "Dispute evidence objects insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dispute_evidence'
  AND name LIKE 'disputes/%'
  AND owner = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.disputes d
    WHERE d.id::text = split_part(name, '/', 2)
      AND (
        d.buyer_id = auth.uid()
        OR d.seller_id = auth.uid()
        OR d.opened_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
      )
  )
);


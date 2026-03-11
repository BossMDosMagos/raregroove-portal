DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'dispute_refund_tasks'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'dispute_refund_tasks' AND column_name = 'proof_file_path'
    ) THEN
      ALTER TABLE public.dispute_refund_tasks ADD COLUMN proof_file_path text;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'dispute_refund_tasks' AND column_name = 'proof_original_filename'
    ) THEN
      ALTER TABLE public.dispute_refund_tasks ADD COLUMN proof_original_filename text;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'dispute_refund_tasks' AND column_name = 'proof_expires_at'
    ) THEN
      ALTER TABLE public.dispute_refund_tasks ADD COLUMN proof_expires_at timestamptz;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'refund_proofs'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('refund_proofs', 'refund_proofs', false);
  END IF;
END $$;

DROP POLICY IF EXISTS "Refund proofs admin read" ON storage.objects;
CREATE POLICY "Refund proofs admin read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'refund_proofs'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
);

DROP POLICY IF EXISTS "Refund proofs admin insert" ON storage.objects;
CREATE POLICY "Refund proofs admin insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'refund_proofs'
  AND owner = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
);

DROP POLICY IF EXISTS "Refund proofs admin delete" ON storage.objects;
CREATE POLICY "Refund proofs admin delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'refund_proofs'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
);


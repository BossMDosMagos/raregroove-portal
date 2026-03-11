DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    CREATE TABLE public.notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      type text NOT NULL,
      title text NOT NULL,
      message text NOT NULL,
      item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
      related_id uuid,
      dedupe_key text,
      is_read boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'item_id'
    ) THEN
      ALTER TABLE public.notifications ADD COLUMN item_id uuid REFERENCES public.items(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'related_id'
    ) THEN
      ALTER TABLE public.notifications ADD COLUMN related_id uuid;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'dedupe_key'
    ) THEN
      ALTER TABLE public.notifications ADD COLUMN dedupe_key text;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'is_read'
    ) THEN
      ALTER TABLE public.notifications ADD COLUMN is_read boolean NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'created_at'
    ) THEN
      ALTER TABLE public.notifications ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_unique ON public.notifications(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own notifications" ON public.notifications;
CREATE POLICY "Users see own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own notifications" ON public.notifications;
CREATE POLICY "Users delete own notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "No insert notifications" ON public.notifications;
CREATE POLICY "No insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (false);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_type_check'
      AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('wishlist_match', 'transaction', 'review', 'message', 'system')) NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_unread_notifications_count(user_uuid uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> user_uuid THEN
    RETURN 0;
  END IF;

  RETURN (
    SELECT COUNT(*)
    FROM public.notifications
    WHERE user_id = user_uuid
      AND is_read = false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> user_uuid THEN
    RETURN;
  END IF;

  UPDATE public.notifications
  SET is_read = true
  WHERE user_id = user_uuid
    AND is_read = false;
END;
$$;

REVOKE ALL ON FUNCTION public.get_unread_notifications_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unread_notifications_count(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_all_notifications_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(uuid) TO authenticated;


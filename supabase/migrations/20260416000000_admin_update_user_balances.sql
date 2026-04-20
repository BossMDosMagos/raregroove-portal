-- Policy de UPDATE para admins em user_balances
-- Necessário para o AdminTrash zerar saldos

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_balances') THEN
    DROP POLICY IF EXISTS "Admin update user_balances" ON public.user_balances;
    CREATE POLICY "Admin update user_balances"
    ON public.user_balances
    FOR UPDATE
    USING (public.is_admin_user(auth.uid()));
    
    RAISE NOTICE 'Admin update policy for user_balances created!';
  END IF;
END $$;

-- Também garantir SELECT para admins
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_balances') THEN
    DROP POLICY IF EXISTS "Admin select user_balances" ON public.user_balances;
    CREATE POLICY "Admin select user_balances"
    ON public.user_balances
    FOR SELECT
    USING (public.is_admin_user(auth.uid()));
    
    RAISE NOTICE 'Admin select policy for user_balances created!';
  END IF;
END $$;

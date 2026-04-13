-- Abrir transactions para debug
DROP POLICY IF EXISTS "Users see own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users see own transactions2" ON public.transactions;
DROP POLICY IF EXISTS "Users insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users insert transactions2" ON public.transactions;

-- Policy mais aberta
CREATE POLICY "Anyone can read transactions"
ON public.transactions
FOR SELECT TO public
USING (true);

CREATE POLICY "Anyone can insert transactions"
ON public.transactions
FOR INSERT TO public
WITH CHECK (true);

CREATE POLICY "Anyone can update transactions"
ON public.transactions
FOR UPDATE TO public
USING (true);
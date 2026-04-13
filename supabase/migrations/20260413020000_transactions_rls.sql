-- Policy para usuarios verem suas proprias transacoes
CREATE POLICY "Users see own transactions"
ON public.transactions
FOR SELECT TO public
USING (
  auth.uid() = buyer_id OR 
  auth.uid() = seller_id
);

-- Policy para usuarios inserirem transacoes
CREATE POLICY "Users insert transactions"
ON public.transactions
FOR INSERT TO public
WITH CHECK (
  auth.uid() = buyer_id OR 
  auth.uid() = seller_id
);
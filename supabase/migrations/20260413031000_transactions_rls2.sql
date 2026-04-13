-- RLS policies para transactions
CREATE POLICY "Users see own transactions2"
ON public.transactions
FOR SELECT TO public
USING (
  auth.uid() = buyer_id OR 
  auth.uid() = seller_id
);

-- Allow public insert for transactions
CREATE POLICY "Users insert transactions2"
ON public.transactions
FOR INSERT TO public
WITH CHECK (
  auth.uid() = buyer_id OR 
  auth.uid() = seller_id
);
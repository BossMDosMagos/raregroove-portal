-- RLS policies para shipping
CREATE POLICY "Users see own shipping"
ON public.shipping
FOR SELECT TO public
USING (
  auth.uid() = buyer_id OR 
  auth.uid() = seller_id
);

CREATE POLICY "Users insert shipping"
ON public.shipping
FOR INSERT TO public
WITH CHECK (
  auth.uid() = buyer_id OR 
  auth.uid() = seller_id
);

CREATE POLICY "Users update shipping"
ON public.shipping
FOR UPDATE TO public
USING (
  auth.uid() = buyer_id OR 
  auth.uid() = seller_id
);
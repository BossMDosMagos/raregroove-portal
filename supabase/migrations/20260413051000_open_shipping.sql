-- Abrir shipping
CREATE POLICY "Anyone can read shipping"
ON public.shipping
FOR SELECT TO public
USING (true);

CREATE POLICY "Anyone can insert shipping"
ON public.shipping
FOR INSERT TO public
WITH CHECK (true);

CREATE POLICY "Anyone can update shipping"
ON public.shipping
FOR UPDATE TO public
USING (true);
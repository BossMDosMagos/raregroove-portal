-- Adicionar política RLS de INSERT para shipping_labels
-- Permite que vendedores criem etiquetas para seus envios

DROP POLICY IF EXISTS "Sellers criam labels" ON public.shipping_labels;
CREATE POLICY "Sellers criam labels"
  ON public.shipping_labels
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.shipping s
    WHERE s.shipping_id = shipping_labels.shipping_id
    AND s.seller_id = auth.uid()
  ));

-- Atualizar política de SELECT para incluir compradores também
DROP POLICY IF EXISTS "Sellers veem labels" ON public.shipping_labels;
CREATE POLICY "Usuários veem labels de suas transações"
  ON public.shipping_labels
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.shipping s
    WHERE s.shipping_id = shipping_labels.shipping_id
    AND (s.seller_id = auth.uid() OR s.buyer_id = auth.uid())
  ));

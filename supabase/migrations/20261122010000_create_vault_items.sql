-- Acervo Digital (Cofre Pessoal / Backup Privado) separado dos anúncios de venda.
-- Um CD físico anunciado e vendido NÃO pode apagar o backup privado do colecionador.
CREATE TABLE IF NOT EXISTS public.vault_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- referência opcional ao item físico de origem (pode ser vendido/excluído sem afetar o backup)
  source_item_id uuid,
  title text NOT NULL,
  artist text,
  cover_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vault_items_owner_idx ON public.vault_items(owner_id);

ALTER TABLE public.vault_items ENABLE ROW LEVEL SECURITY;

-- Dono vê/apaga apenas seus próprios backups; leitura via service_role (Edge Functions)
DROP POLICY IF EXISTS "vault_items_owner_select" ON public.vault_items;
CREATE POLICY "vault_items_owner_select" ON public.vault_items
  FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "vault_items_owner_insert" ON public.vault_items;
CREATE POLICY "vault_items_owner_insert" ON public.vault_items
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "vault_items_owner_update" ON public.vault_items;
CREATE POLICY "vault_items_owner_update" ON public.vault_items
  FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "vault_items_owner_delete" ON public.vault_items;
CREATE POLICY "vault_items_owner_delete" ON public.vault_items
  FOR DELETE USING (auth.uid() = owner_id);

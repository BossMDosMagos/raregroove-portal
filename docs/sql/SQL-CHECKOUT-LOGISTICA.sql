-- =============================================================================
-- CHECKOUT E LOGÍSTICA - EXTENSÃO PARA PLATFORM_SETTINGS E ITEMS
-- Data: 25/02/2026
-- =============================================================================
-- 1. Estender ITEMS com campos de frete e estoque
-- 2. Criar tabela SHIPPING para rastreamento
-- 3. Criar tabela SHIPPING_LABELS para etiquetas pré-pagas
-- 4. Adicionar configurações de integração de frete
-- =============================================================================

-- =============================================================================
-- 1) ESTENDER TABELA ITEMS COM FRETE E ESTOQUE
-- =============================================================================
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS fixed_shipping_cost NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS shipping_from_cep TEXT,
  ADD COLUMN IF NOT EXISTS shipping_weight_kg NUMERIC(8, 3),
  ADD COLUMN IF NOT EXISTS allow_estimate_shipping BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_sold BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sold_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_items_stock
  ON public.items(is_sold, stock_quantity);

-- =============================================================================
-- 2) TABELA SHIPPING - RASTREAMENTO DE FRETES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.shipping (
  shipping_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
  buyer_id UUID REFERENCES auth.users(id) NOT NULL,
  seller_id UUID REFERENCES auth.users(id) NOT NULL,
  item_id UUID REFERENCES public.items(id),
  
  -- Endereços
  from_cep TEXT NOT NULL,
  from_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  to_cep TEXT NOT NULL,
  to_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Valores
  estimated_cost NUMERIC(10, 2),
  final_cost NUMERIC(10, 2),
  has_insurance BOOLEAN NOT NULL DEFAULT false,
  insurance_cost NUMERIC(10, 2) DEFAULT 0,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'awaiting_label'
    CHECK (status IN ('awaiting_label', 'label_generated', 'in_transit', 'delivered', 'returned', 'cancelled')),
  
  -- Integração
  carrier TEXT, -- 'correios', 'melhor_envio', etc
  tracking_code TEXT,
  label_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shipping_transaction
  ON public.shipping(transaction_id);

CREATE INDEX IF NOT EXISTS idx_shipping_status
  ON public.shipping(status);

CREATE INDEX IF NOT EXISTS idx_shipping_tracking
  ON public.shipping(tracking_code);

-- =============================================================================
-- 3) TABELA SHIPPING_LABELS - ETIQUETAS PRÉ-PAGAS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.shipping_labels (
  label_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shipping_id UUID REFERENCES public.shipping(shipping_id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Integração
  carrier TEXT NOT NULL,
  tracking_code TEXT UNIQUE NOT NULL,
  
  -- Dados da etiqueta
  label_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  label_url TEXT,
  label_pdf_url TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'generated'
    CHECK (status IN ('generated', 'printed', 'dispatched', 'in_transit', 'delivered')),
  
  -- Custos
  label_cost NUMERIC(10, 2) NOT NULL,
  prepaid BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  printed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_labels_tracking
  ON public.shipping_labels(tracking_code);

-- =============================================================================
-- 4) ESTENDER TRANSACTIONS COM FRETE E SEGURO
-- =============================================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS insurance_cost NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_id UUID REFERENCES public.shipping(shipping_id);

-- =============================================================================
-- 5) ESTENDER SWAPS COM MESMO CONTROLE
-- =============================================================================
ALTER TABLE public.swaps
  ADD COLUMN IF NOT EXISTS user_1_item_reserved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS user_2_item_reserved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMPTZ;

-- =============================================================================
-- 6) ADICIONAR CONFIGURAÇÕES DE FRETE NO PLATFORM_SETTINGS
-- =============================================================================
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS shipping_api_provider TEXT,
  ADD COLUMN IF NOT EXISTS shipping_api_key TEXT,
  ADD COLUMN IF NOT EXISTS melhor_envio_api_key TEXT,
  ADD COLUMN IF NOT EXISTS correios_api_key TEXT,
  ADD COLUMN IF NOT EXISTS insurance_percentage NUMERIC(5, 2) DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS default_shipping_from_cep TEXT;

-- =============================================================================
-- 7) FUNÇÃO PARA RESERVAR ITEMS (SWAPS)
-- =============================================================================
CREATE OR REPLACE FUNCTION reserve_item_for_swap(p_item_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.items
  SET reserved_until = NOW() + INTERVAL '24 hours'
  WHERE id = p_item_id AND is_sold = false;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 8) FUNÇÃO PARA CONFIRMAR VENDA (MARCAR ITEM COMO VENDIDO)
-- =============================================================================
CREATE OR REPLACE FUNCTION mark_item_as_sold(p_item_id UUID, p_buyer_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.items
  SET 
    is_sold = true,
    sold_to_user_id = p_buyer_id,
    sold_at = NOW()
  WHERE id = p_item_id AND is_sold = false;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 9) FUNÇÃO PARA ESTIMAR FRETE
-- =============================================================================
CREATE OR REPLACE FUNCTION estimate_shipping(
  p_from_cep TEXT,
  p_to_cep TEXT,
  p_weight_kg NUMERIC
)
RETURNS TABLE(
  carrier TEXT,
  estimated_cost NUMERIC,
  estimated_days INTEGER,
  service_name TEXT
) AS $$
BEGIN
  -- Esta função será chamada por RPC para integrar com API externa
  -- Por enquanto, retorna estrutura básica
  RETURN QUERY
  SELECT 
    'melhor_envio'::TEXT,
    CAST(20.00 AS NUMERIC),
    5::INTEGER,
    'SEDEX'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 10) RLS POLICIES PARA NOVAS TABELAS
-- =============================================================================
ALTER TABLE public.shipping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_labels ENABLE ROW LEVEL SECURITY;

-- Shipping: buyer e seller veem suas transações
DROP POLICY IF EXISTS "Usuários veem seu shipping" ON public.shipping;
CREATE POLICY "Usuários veem seu shipping"
  ON public.shipping
  FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Usuários criam shipping" ON public.shipping;
CREATE POLICY "Usuários criam shipping"
  ON public.shipping
  FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Usuários atualizam seu shipping" ON public.shipping;
CREATE POLICY "Usuários atualizam seu shipping"
  ON public.shipping
  FOR UPDATE
  USING (auth.uid() = seller_id OR auth.uid() = buyer_id);

-- Labels: apenas seller pode ver e atualizar
DROP POLICY IF EXISTS "Sellers veem labels" ON public.shipping_labels;
CREATE POLICY "Sellers veem labels"
  ON public.shipping_labels
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.shipping s
    WHERE s.shipping_id = shipping_labels.shipping_id
    AND s.seller_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Sellers atualizam labels" ON public.shipping_labels;
CREATE POLICY "Sellers atualizam labels"
  ON public.shipping_labels
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.shipping s
    WHERE s.shipping_id = shipping_labels.shipping_id
    AND s.seller_id = auth.uid()
  ));

-- =============================================================================
-- VERIFICAÇÃO FINAL
-- =============================================================================
SELECT '✅ Checkout e logística estrutura criada com sucesso' AS status;

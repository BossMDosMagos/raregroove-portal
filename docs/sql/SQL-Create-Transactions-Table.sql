-- ========================================
-- TABELA DE TRANSAÇÕES - RAREGROOVE
-- ========================================
-- Este script cria a estrutura necessária para gerenciar
-- o ciclo completo de compra/venda de itens

-- 1. Criar tabela de transações
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  buyer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  seller_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'enviado', 'concluido', 'cancelado')),
  price decimal(10, 2) NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 2. Adicionar coluna de status na tabela items (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'items' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.items 
    ADD COLUMN status text DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'reservado', 'vendido'));
    RAISE NOTICE '✅ Coluna status adicionada à tabela items!';
  ELSE
    RAISE NOTICE 'ℹ️ Coluna status já existe na tabela items';
  END IF;
END $$;

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON public.transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_seller ON public.transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_transactions_item ON public.transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_items_status ON public.items(status);

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de segurança para transactions
-- Usuários podem ver suas próprias transações (como comprador ou vendedor)
CREATE POLICY "Usuários veem suas transações"
  ON public.transactions
  FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Apenas vendedores podem criar transações
CREATE POLICY "Vendedores criam transações"
  ON public.transactions
  FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

-- Comprador e vendedor podem atualizar transações
CREATE POLICY "Partes atualizam transações"
  ON public.transactions
  FOR UPDATE
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- 6. Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_transactions_updated_at ON public.transactions;
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 8. Verificação final
SELECT 
  '✅ Tabela transactions criada: ' || 
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions')
    THEN 'SIM'
    ELSE 'NÃO'
  END as tabela_transactions;

SELECT 
  '✅ Coluna status em items: ' ||
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'status')
    THEN 'SIM'
    ELSE 'NÃO'
  END as coluna_status;

SELECT 
  '✅ Total de políticas RLS: ' || COUNT(*)::text
FROM pg_policies
WHERE tablename = 'transactions';

-- 9. Comentários de documentação
COMMENT ON TABLE public.transactions IS 'Gerencia o ciclo completo de vendas no marketplace';
COMMENT ON COLUMN public.transactions.status IS 'pendente=aguardando pagamento | pago=confirmado | enviado=em trânsito | concluido=finalizado | cancelado=abortado';
COMMENT ON COLUMN public.items.status IS 'disponivel=no catálogo | reservado=em negociação | vendido=transação concluída';

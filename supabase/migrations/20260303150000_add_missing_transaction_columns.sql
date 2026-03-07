-- Migration: Add missing columns for transaction tracking
-- Descrição: Adiciona colunas essenciais que faltam no schema

-- 1. Adicionar payment_id na tabela transactions
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'transactions' 
    AND column_name = 'payment_id'
  ) THEN
    ALTER TABLE public.transactions 
    ADD COLUMN payment_id text UNIQUE;
    RAISE NOTICE '✅ Coluna payment_id adicionada à tabela transactions!';
  ELSE
    RAISE NOTICE 'ℹ️ Coluna payment_id já existe na tabela transactions';
  END IF;
END $$;

-- 2. Adicionar sold_to_id na tabela items
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'items' 
    AND column_name = 'sold_to_id'
  ) THEN
    ALTER TABLE public.items 
    ADD COLUMN sold_to_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ Coluna sold_to_id adicionada à tabela items!';
  ELSE
    RAISE NOTICE 'ℹ️ Coluna sold_to_id já existe na tabela items';
  END IF;
END $$;

-- 3. Adicionar sold_date na tabela items
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'items' 
    AND column_name = 'sold_date'
  ) THEN
    ALTER TABLE public.items 
    ADD COLUMN sold_date timestamp with time zone;
    RAISE NOTICE '✅ Coluna sold_date adicionada à tabela items!';
  ELSE
    RAISE NOTICE 'ℹ️ Coluna sold_date já existe na tabela items';
  END IF;
END $$;

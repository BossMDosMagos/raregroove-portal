-- SQL para executar no Supabase SQL Editor

-- Tabela para rastrear leitura de mensagens
CREATE TABLE public.message_reads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid REFERENCES public.messages NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  read_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(message_id, user_id)
);

ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

-- Política: Usuários só leem seus próprios registros de leitura
CREATE POLICY "View own message reads" ON public.message_reads
FOR SELECT USING (auth.uid() = user_id);

-- Política: Usuários só inserem registros de leitura como eles mesmos
CREATE POLICY "Insert own message reads" ON public.message_reads
FOR INSERT WITH CHECK (auth.uid() = user_id);

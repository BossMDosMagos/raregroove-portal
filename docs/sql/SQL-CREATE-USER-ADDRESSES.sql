-- ============================================================================
-- CRIAR TABELA DE ENDEREÇOS DO USUÁRIO
-- ============================================================================
-- Data: 2026-03-01
-- Objetivo: Permitir que usuários tenham múltiplos endereços de recebimento
-- Similar ao Mercado Livre
--
-- EXECUTE ESTE SCRIPT NO SUPABASE SQL EDITOR (cada comando de uma vez)
-- ============================================================================

-- ============================================================================
-- PARTE 1: CRIAR TABELA user_addresses
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Informações do Endereço
  label text NOT NULL, -- "Casa", "Trabalho", "Avó", etc.
  full_name text NOT NULL, -- Nome para quem enviar
  phone text, -- Telefone para contato
  cep text NOT NULL,
  address text NOT NULL,
  number text NOT NULL,
  complement text,
  city text NOT NULL,
  state text NOT NULL CHECK (length(state) = 2),
  
  -- Controle de Endereço Principal
  is_default boolean DEFAULT false,
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_user_addresses_user_id ON public.user_addresses(user_id);
CREATE INDEX idx_user_addresses_is_default ON public.user_addresses(user_id, is_default);

-- Índice único parcial para garantir apenas um endereço default por usuário
CREATE UNIQUE INDEX idx_unique_default_per_user 
ON public.user_addresses(user_id) 
WHERE is_default = true;

-- ============================================================================
-- PARTE 2: ATIVAR RLS (Row Level Security)
-- ============================================================================

ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PARTE 3: CRIAR POLÍTICAS RLS
-- ============================================================================

-- a) POLÍTICA SELECT: Usuário vê apenas seus próprios endereços
DROP POLICY IF EXISTS "Usuários podem ver seus endereços" ON public.user_addresses;
CREATE POLICY "Usuários podem ver seus endereços"
ON public.user_addresses
FOR SELECT
USING (auth.uid() = user_id);

-- b) POLÍTICA INSERT: Usuário pode inserir endereços para si mesmo
DROP POLICY IF EXISTS "Usuários podem criar endereços" ON public.user_addresses;
CREATE POLICY "Usuários podem criar endereços"
ON public.user_addresses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- c) POLÍTICA UPDATE: Usuário pode atualizar seus endereços
DROP POLICY IF EXISTS "Usuários podem atualizar endereços" ON public.user_addresses;
CREATE POLICY "Usuários podem atualizar endereços"
ON public.user_addresses
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- d) POLÍTICA DELETE: Usuário pode deletar seus endereços
DROP POLICY IF EXISTS "Usuários podem deletar endereços" ON public.user_addresses;
CREATE POLICY "Usuários podem deletar endereços"
ON public.user_addresses
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- PARTE 4: CRIAR FUNÇÃO PARA GARANTIR APENAS UM ENDEREÇO PRINCIPAL
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_address_as_default(address_id uuid)
RETURNS void AS $$
BEGIN
  -- Remover default de todos os endereços do usuário
  UPDATE public.user_addresses
  SET is_default = false,
      updated_at = now()
  WHERE id IN (
    SELECT id FROM public.user_addresses 
    WHERE user_id = (SELECT user_id FROM public.user_addresses WHERE id = address_id)
  );
  
  -- Setar o novo como default
  UPDATE public.user_addresses
  SET is_default = true,
      updated_at = now()
  WHERE id = address_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PARTE 5: CRIAR TRIGGER PARA ATUALIZAR updated_at AUTOMATICAMENTE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_address_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_addresses_timestamp ON public.user_addresses;
CREATE TRIGGER update_user_addresses_timestamp
BEFORE UPDATE ON public.user_addresses
FOR EACH ROW
EXECUTE FUNCTION public.update_address_timestamp();

-- ============================================================================
-- PARTE 6: VALIDAÇÕES COMENTADAS (para usar em views se necessário)
-- ============================================================================

-- Para verificar que apenas um endereço é default por usuário:
-- SELECT user_id, COUNT(*) as default_count 
-- FROM public.user_addresses 
-- WHERE is_default = true 
-- GROUP BY user_id 
-- HAVING COUNT(*) > 1;
-- Resultado esperado: (sem resultados / vazio)

-- Para listar todos os endereços de um usuário (incluindo o default):
-- SELECT user_id, label, full_name, cep, address, is_default
-- FROM public.user_addresses
-- WHERE user_id = 'SEU_USER_ID'
-- ORDER BY is_default DESC, created_at DESC;

-- ============================================================================
-- PARTE 7: PERMISSÕES E ADMINS
-- ============================================================================

-- Se precisar que ADMINS possam ver/editar endereços de qualquer usuário,
-- descomentar abaixo (após implementar função is_admin_user no Supabase):

-- DROP POLICY IF EXISTS "Admins podem gerenciar todos os endereços" ON public.user_addresses;
-- CREATE POLICY "Admins podem gerenciar todos os endereços"
-- ON public.user_addresses
-- FOR ALL
-- USING (public.is_admin_user())
-- WITH CHECK (public.is_admin_user());

-- ============================================================================
-- RESULTADO ESPERADO
-- ============================================================================
-- ✅ Tabela user_addresses criada com sucesso
-- ✅ RLS ativado com políticas corretas
-- ✅ Função set_address_as_default criada
-- ✅ Trigger de timestamp criado
-- ✅ Usuários podem gerenciar múltiplos endereços
-- ✅ Apenas um endereço por usuário pode ser default
-- ✅ Endereços são deletados quando usuário é removido (CASCADE)

-- ============================================================================

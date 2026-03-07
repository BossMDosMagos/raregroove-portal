# 🚨 INSTRUÇÕES URGENTES - EXECUTE AGORA

## Passo 1: Execute este SQL no Supabase

1. Abra o Supabase Dashboard
2. Vá em **SQL Editor** (ícone de banco de dados no menu lateral)
3. Clique em **New Query**
4. **COPIE E COLE TODO O CÓDIGO ABAIXO:**

```sql
-- ========================================
-- SCRIPT DE CORREÇÃO COMPLETA
-- ========================================

-- 1. Adicionar campo read_at
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'messages' 
    AND column_name = 'read_at'
  ) THEN
    ALTER TABLE public.messages 
    ADD COLUMN read_at timestamp with time zone DEFAULT NULL;
    RAISE NOTICE '✅ Coluna read_at adicionada!';
  ELSE
    RAISE NOTICE 'ℹ️ Coluna read_at já existe';
  END IF;
END $$;

-- 2. Ativar Realtime
DO $$
BEGIN
  -- Tentar adicionar à publication (ignora se já existe)
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  RAISE NOTICE '✅ Realtime ativado!';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'ℹ️ Realtime já estava ativo';
END $$;

-- 3. LIMPAR TODAS AS MENSAGENS ANTIGAS (marcar como lidas)
-- Isso vai zerar o contador para todos
UPDATE messages 
SET read_at = NOW() 
WHERE read_at IS NULL;

-- 4. VERIFICAÇÃO FINAL
SELECT 
  '✅ Campo read_at existe: ' || 
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'read_at')
    THEN 'SIM'
    ELSE 'NÃO'
  END as campo;

SELECT 
  '✅ Realtime ativo: ' ||
  CASE 
    WHEN EXISTS(SELECT 1 FROM pg_publication_tables WHERE tablename = 'messages' AND pubname = 'supabase_realtime')
    THEN 'SIM'
    ELSE 'NÃO'
  END as realtime;

SELECT 
  '✅ Mensagens não lidas restantes: ' || COUNT(*)::text
FROM messages
WHERE read_at IS NULL;
```

5. Clique em **RUN** (ou pressione Ctrl+Enter)

## Passo 2: Verifique os Resultados

Você deve ver no resultado:

```
✅ Campo read_at existe: SIM
✅ Realtime ativo: SIM
✅ Mensagens não lidas restantes: 0
```

## Passo 3: Teste no Navegador

1. **Recarregue a página** (Ctrl + Shift + R para forçar)
2. **Abra o Console** (F12)
3. **Vá em /mensagens**
   - Contador do sininho deve mostrar **0**
   - Badges nas conversas devem estar zerados

4. **Teste com nova mensagem:**
   - Abra outro navegador
   - Faça login com outra conta
   - Envie mensagem
   - No navegador principal: sininho deve mostrar **1**

## ⚠️ SE O SININHO AINDA MOSTRAR NÚMERO ERRADO

Digite no console do navegador (F12 → Console):

```javascript
// Verificar quantas mensagens não lidas você tem
const { data } = await supabase
  .from('messages')
  .select('id, content, read_at')
  .eq('receiver_id', '[SEU_USER_ID]')
  .is('read_at', null);

console.table(data);
console.log('Total não lidas:', data?.length || 0);
```

Substitua `[SEU_USER_ID]` pelo seu ID real (aparece nos logs do console).

## 🎯 O que cada correção faz:

1. **Adiciona campo read_at** → Sem ele, não dá para rastrear mensagens lidas
2. **Ativa Realtime** → Sem ele, contador não atualiza automaticamente
3. **Limpa mensagens antigas** → Marca tudo como lido para começar do zero
4. **Verificação** → Mostra se tudo está configurado

## 📞 Me mostre:

Depois de executar o SQL, me envie:
1. Screenshot ou texto dos 3 resultados (✅ Campo, ✅ Realtime, ✅ Mensagens)
2. O que aparece no sininho depois de recarregar

Se der qualquer erro no SQL, copie e cole a mensagem de erro completa!

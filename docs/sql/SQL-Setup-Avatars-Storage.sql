/*
╔═════════════════════════════════════════════════════════════════════════════════╗
║              SETUP DO BUCKET AVATARS - SUPABASE STORAGE                         ║
║                     Sistema de Fotos de Perfil                                  ║
╚═════════════════════════════════════════════════════════════════════════════════╝

INSTRUÇÕES:
1. Ir em Supabase Dashboard → Storage
2. Criar um novo bucket chamado "avatars"
3. Depois, ir em SQL Editor e executar este script para configurar as políticas

*/

-- ========================================
-- CONFIGURAR POLÍTICAS RLS PARA O BUCKET AVATARS
-- ========================================

-- 1. LEITURA PÚBLICA (qualquer um pode ver avatares)
CREATE POLICY "Avatares são públicos para leitura"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- 2. INSERÇÃO: Apenas dono pode fazer upload da sua própria foto
CREATE POLICY "Usuários podem fazer upload de seu próprio avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. ATUALIZAÇÃO: Apenas dono pode atualizar sua própria foto
CREATE POLICY "Usuários podem atualizar seu próprio avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. DELEÇÃO: Apenas dono pode deletar sua própria foto
CREATE POLICY "Usuários podem deletar seu próprio avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

/*
╔═════════════════════════════════════════════════════════════════════════════════╗
║                         ESTRUTURA DE PASTAS                                     ║
╚═════════════════════════════════════════════════════════════════════════════════╝

Cada avatar é salvo como:
  avatars/{user_id}/avatar.png

Exemplo:
  avatars/550e8400-e29b-41d4-a716-446655440000/avatar.png

A URL pública será:
  https://[SEU-PROJETO].supabase.co/storage/v1/object/public/avatars/{user_id}/avatar.png

*/

/*
╔═════════════════════════════════════════════════════════════════════════════════╗
║                    INSTRUÇÕES DE CRIAÇÃO DO BUCKET                              ║
╚═════════════════════════════════════════════════════════════════════════════════╝

NO PAINEL DO SUPABASE:

1. Ir em: Storage (menu lateral esquerdo)
2. Clicar em: "Create a new bucket" ou "+ New Bucket"
3. Nome do Bucket: avatars
4. Público: ✅ SIM (marcar como público)
5. Allowed MIME types: image/jpeg, image/png, image/webp, image/gif
6. Max file size: 2MB (ou o que preferir)
7. Clicar em "Save"

DEPOIS, execute este arquivo SQL completo no SQL Editor.

*/

-- Confirmação
SELECT 'Políticas RLS para avatares configuradas com sucesso! ✅' as resultado;

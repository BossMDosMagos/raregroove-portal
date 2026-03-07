import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

const toastSuccessStyle = { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' };
const toastErrorStyle = { background: '#050505', border: '1px solid #ef4444', color: '#FFF' };

/**
 * Cria um perfil inicial quando o usuário se registra
 * Chamado após o signUp bem-sucedido
 * Usa UPDATE porque o trigger handle_new_user já criou o perfil básico
 */
export const createProfileOnSignUp = async (user) => {
  try {
    console.log('Aguardando trigger criar perfil básico...');
    
    // Aguardar 500ms para garantir que o trigger handle_new_user executou
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('Tentando atualizar perfil com dados completos:', user);
    
    // Usar UPDATE direto em vez de UPSERT (trigger já criou o perfil)
    const { data, error } = await supabase
      .from('profiles')
      .update({
        cpf_cnpj: user.cpf_cnpj || null,
        rg: user.rg || null,
        updated_at: new Date()
      })
      .eq('id', user.id)
      .select();

    if (error) {
      console.error('Erro ao atualizar perfil:', error);
      console.error('Detalhes do erro:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      return { success: false, error };
    }
    
    console.log('Perfil atualizado com sucesso:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Erro ao atualizar perfil (catch):', error);
    return { success: false, error };
  }
};

/**
 * Busca os dados completos do perfil do usuário logado
 */
export const fetchProfile = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Erro ao buscar perfil:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    return null;
  }
};

/**
 * Atualiza o perfil do usuário (UPDATE direto - não usa UPSERT)
 * IMPORTANTE: Usar UPDATE em vez de UPSERT porque não temos política INSERT
 */
export const upsertProfile = async (userId, profileData) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        ...profileData,
        updated_at: new Date()
      })
      .eq('id', userId);

    if (error) {
      console.error('Erro ao salvar perfil:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    throw error;
  }
};

/**
 * Busca o nome do usuário para exibir em conversas
 */
export const fetchUserName = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Erro ao buscar nome:', error);
      return 'Usuário';
    }

    return data?.full_name || 'Usuário';
  } catch (error) {
    console.error('Erro ao buscar nome:', error);
    return 'Usuário';
  }
};

/**
 * Busca múltiplos nomes de usuários
 */
export const fetchUserNames = async (userIds) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);

    if (error) {
      console.error('Erro ao buscar nomes:', error);
      return {};
    }

    // Converter para objeto {id: name}
    const nameMap = {};
    data?.forEach(profile => {
      nameMap[profile.id] = profile.full_name || 'Usuário';
    });

    return nameMap;
  } catch (error) {
    console.error('Erro ao buscar nomes:', error);
    return {};
  }
};

/**
 * Faz upload de avatar para o Supabase Storage
 * @param {string} userId - ID do usuário
 * @param {File} file - Arquivo de imagem
 * @returns {Promise<string|null>} URL pública do avatar ou null se falhar
 */
export const uploadAvatar = async (userId, file) => {
  try {
    // Validar tipo de arquivo
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast.error('Formato inválido. Use JPG, PNG, WebP ou GIF');
      return null;
    }

    // Validar tamanho (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo: 2MB');
      return null;
    }

    // Caminho do arquivo: avatars/{userId}/avatar.png
    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/avatar.${fileExt}`;

    // Deletar avatar antigo se existir
    await supabase.storage
      .from('avatars')
      .remove([filePath]);

    // Upload do novo avatar
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('Erro ao fazer upload:', uploadError);
      toast.error('Erro ao fazer upload da imagem');
      return null;
    }

    // Obter URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    // Atualizar avatar_url na tabela profiles
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl, updated_at: new Date() })
      .eq('id', userId);

    if (updateError) {
      console.error('Erro ao atualizar perfil:', updateError);
      toast.error('Avatar salvo mas erro ao atualizar perfil');
    }

    return publicUrl;
  } catch (error) {
    console.error('Erro no upload de avatar:', error);
    toast.error('Erro ao fazer upload');
    return null;
  }
};

/**
 * Remove o avatar do usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<boolean>} true se removido com sucesso
 */
export const removeAvatar = async (userId) => {
  try {
    // Buscar perfil para pegar a URL do avatar
    const profile = await fetchProfile(userId);
    if (!profile?.avatar_url) {
      return true; // Já não tem avatar
    }

    // Extrair o caminho do arquivo da URL
    const urlParts = profile.avatar_url.split('/avatars/');
    if (urlParts.length > 1) {
      const filePath = urlParts[1];
      
      // Deletar do storage
      await supabase.storage
        .from('avatars')
        .remove([filePath]);
    }

    // Limpar avatar_url do perfil
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: null, updated_at: new Date() })
      .eq('id', userId);

    if (error) {
      console.error('Erro ao remover avatar:', error);
      return false;
    }

    toast.success('Avatar removido', {
      style: toastSuccessStyle,
    });
    return true;
  } catch (error) {
    console.error('Erro ao remover avatar:', error);
    toast.error('Erro ao remover avatar', {
      style: toastErrorStyle,
    });
    return false;
  }
};

/**
 * Faz upload de comprovante de PIX para processamento de saque
 * @param {string} userId - ID do usuário que solicitou o saque
 * @param {string} withdrawalId - ID do saque
 * @param {File} file - Arquivo do comprovante (PDF ou imagem)
 * @returns {Promise<{
 *  userProofPath: string,
 *  adminProofPath: string,
 *  originalFilename: string,
 *  expiresAt: string
 * }|null>} Dados dos comprovantes ou null se falhar
 */
export const uploadWithdrawalProof = async ({ userId, withdrawalId, file }) => {
  try {
    // Validar tipo de arquivo - aceita PDF e imagens
    const validTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif'
    ];
    if (!validTypes.includes(file.type)) {
      toast.error('FORMATO INVÁLIDO', {
        description: 'Use PDF, JPG, PNG, WebP ou GIF.',
        style: toastErrorStyle,
      });
      return null;
    }

    // Validar tamanho (5MB max para comprovante)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error('ARQUIVO MUITO GRANDE', {
        description: 'Tamanho máximo permitido: 5MB.',
        style: toastErrorStyle,
      });
      return null;
    }

    if (!userId || !withdrawalId) {
      toast.error('DADOS INCOMPLETOS', {
        description: 'Não foi possível identificar usuário/saque para upload.',
        style: toastErrorStyle,
      });
      return null;
    }

    // Caminhos do arquivo:
    // 1) Cópia do usuário (rastreável ao solicitante)
    // 2) Cópia administrativa (lista de liberação)
    const fileExt = (file.name.split('.').pop() || 'bin').toLowerCase();
    const timestamp = Date.now();
    const userProofPath = `users/${userId}/withdrawals/${withdrawalId}/proof_${timestamp}.${fileExt}`;
    const adminProofPath = `admin_archive/${withdrawalId}/user_${userId}_${timestamp}.${fileExt}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Upload da cópia do usuário
    const { error: userUploadError } = await supabase.storage
      .from('withdrawal_proofs')
      .upload(userProofPath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (userUploadError) {
      console.error('Erro ao fazer upload da cópia do usuário:', userUploadError);

      const bucketNotFound = /bucket not found/i.test(userUploadError.message || '');
      toast.error('ERRO NO UPLOAD', {
        description: bucketNotFound
          ? 'Bucket withdrawal_proofs não encontrado. Execute o SQL de implementação para criar o bucket e políticas.'
          : (userUploadError.message || 'Falha ao enviar comprovante para o usuário.'),
        style: toastErrorStyle,
      });
      return null;
    }

    // Upload da cópia administrativa
    const { error: adminUploadError } = await supabase.storage
      .from('withdrawal_proofs')
      .upload(adminProofPath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (adminUploadError) {
      console.error('Erro ao fazer upload da cópia administrativa:', adminUploadError);

      // rollback da cópia do usuário para manter consistência
      await supabase.storage
        .from('withdrawal_proofs')
        .remove([userProofPath]);

      const bucketNotFound = /bucket not found/i.test(adminUploadError.message || '');
      toast.error('ERRO NO ARQUIVO ADMINISTRATIVO', {
        description: bucketNotFound
          ? 'Bucket withdrawal_proofs não encontrado. Execute o SQL de implementação para criar o bucket e políticas.'
          : (adminUploadError.message || 'Falha ao arquivar comprovante no administrativo.'),
        style: toastErrorStyle,
      });
      return null;
    }

    return {
      userProofPath,
      adminProofPath,
      originalFilename: file.name,
      expiresAt,
    };
  } catch (error) {
    console.error('Erro no upload de comprovante:', error);
    toast.error('ERRO AO ENVIAR COMPROVANTE', {
      description: error.message || 'Tente novamente em alguns instantes.',
      style: toastErrorStyle,
    });
    return null;
  }
};

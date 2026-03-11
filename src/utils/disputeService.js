import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

const toastSuccessStyle = { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' };
const toastErrorStyle = { background: '#050505', border: '1px solid #ef4444', color: '#FFF' };

export const uploadDisputeEvidence = async ({ disputeId, file }) => {
  try {
    const validTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/quicktime'
    ];
    if (!validTypes.includes(file.type)) {
      toast.error('FORMATO INVÁLIDO', {
        description: 'Use PDF, imagens (JPG/PNG/WebP/GIF) ou vídeo (MP4/MOV).',
        style: toastErrorStyle,
      });
      return null;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('ARQUIVO MUITO GRANDE', {
        description: 'Tamanho máximo permitido: 10MB.',
        style: toastErrorStyle,
      });
      return null;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      toast.error('NÃO AUTENTICADO', { style: toastErrorStyle });
      return null;
    }

    const fileExt = (file.name.split('.').pop() || 'bin').toLowerCase();
    const timestamp = Date.now();
    const filePath = `disputes/${disputeId}/evidence_${timestamp}_${user.id}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('dispute_evidence')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      const bucketNotFound = /bucket not found/i.test(uploadError.message || '');
      toast.error('ERRO NO UPLOAD', {
        description: bucketNotFound
          ? 'Bucket dispute_evidence não encontrado. Execute o SQL de implementação do bucket/políticas.'
          : (uploadError.message || 'Falha ao enviar evidência.'),
        style: toastErrorStyle,
      });
      return null;
    }

    const { data: row, error: insertError } = await supabase
      .from('dispute_evidence')
      .insert([{
        dispute_id: disputeId,
        uploader_id: user.id,
        file_path: filePath,
        file_name: file.name,
        mime_type: file.type,
      }])
      .select()
      .single();

    if (insertError) {
      await supabase.storage.from('dispute_evidence').remove([filePath]);
      toast.error('ERRO AO REGISTRAR', {
        description: insertError.message || 'Falha ao registrar evidência.',
        style: toastErrorStyle,
      });
      return null;
    }

    toast.success('EVIDÊNCIA ENVIADA', { style: toastSuccessStyle });
    return row;
  } catch (error) {
    toast.error('ERRO', {
      description: error.message || 'Falha ao enviar evidência.',
      style: toastErrorStyle,
    });
    return null;
  }
};


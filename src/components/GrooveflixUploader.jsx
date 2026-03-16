import React, { useCallback, useState } from 'react';
import { Upload, X, FileAudio, File, FileText, CheckCircle, AlertCircle, Loader2, Music, Disc, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useI18n } from '../contexts/I18nContext.jsx';

const CATEGORIES = [
  { id: 'single', label: 'Single', icon: Music, description: 'Faixas individuais' },
  { id: 'album', label: 'Álbum', icon: Disc, description: 'Álbum completo' },
  { id: 'coletanea', label: 'Coletânea', icon: FolderOpen, description: 'Compilação de faixas' },
  { id: 'iso', label: 'ISO', icon: File, description: 'CD completo (imagem)' },
];

export default function GrooveflixUploader({ isOpen, onClose, item, onSuccess }) {
  const { t } = useI18n();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [category, setCategory] = useState(item?.metadata?.grooveflix?.category || 'album');
  const [files, setFiles] = useState({
    audio: null,
    preview: null,
    iso: null,
    booklet: null,
  });
  const [metadata, setMetadata] = useState({
    title: item?.title || '',
    artist: item?.artist || '',
    year: item?.year || '',
    genre: item?.genre || '',
  });

  const handleFileSelect = (type, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const validations = {
      audio: ['audio/mpeg', 'audio/flac', 'audio/wav', 'audio/x-wav', 'audio/mp3'],
      preview: ['audio/mpeg', 'audio/mp3', 'audio/flac'],
      iso: ['application/x-iso9660-image'],
      booklet: ['application/pdf'],
    };

    if (validations[type] && !validations[type].includes(file.type)) {
      toast.error('Tipo de arquivo inválido', {
        description: `Aceitos: ${validations[type].join(', ')}`,
      });
      return;
    }

    // Limite de 500MB
    if (file.size > 500 * 1024 * 1024) {
      toast.error('Arquivo muito grande', {
        description: 'Máximo: 500MB',
      });
      return;
    }

    setFiles(prev => ({ ...prev, [type]: file }));
  };

  const uploadFile = async (file, path) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const filePath = `${user.id}/${Date.now()}_${file.name}`;
    
    const { error } = await supabase.storage
      .from('grooveflix')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    // Obter URL pública (signed URL por 1 ano)
    const { data: { signedUrl } } = await supabase.storage
      .from('grooveflix')
      .createSignedUrl(filePath, 31536000);

    return { path: filePath, url: signedUrl };
  };

  const handleUpload = async () => {
    if (!metadata.title || !metadata.artist) {
      toast.error('Preencha o título e artista');
      return;
    }

    if (!files.audio && !files.iso) {
      toast.error('Adicione pelo menos um arquivo de áudio ou ISO');
      return;
    }

    setUploading(true);
    setUploadProgress({});

    try {
      const grooveflixData = {
        category,
        audio_path: null,
        preview_path: null,
        iso_path: null,
        booklet_path: null,
      };

      // Upload de áudio principal
      if (files.audio) {
        setUploadProgress(p => ({ ...p, audio: 'updating' }));
        const audioResult = await uploadFile(files.audio, 'audio');
        grooveflixData.audio_path = audioResult.path;
        grooveflixData.audio_url = audioResult.url;
        setUploadProgress(p => ({ ...p, audio: 'done' }));
      }

      // Upload de preview (opcional)
      if (files.preview) {
        setUploadProgress(p => ({ ...p, preview: 'updating' }));
        const previewResult = await uploadFile(files.preview, 'preview');
        grooveflixData.preview_path = previewResult.path;
        grooveflixData.preview_url = previewResult.url;
        setUploadProgress(p => ({ ...p, preview: 'done' }));
      }

      // Upload de ISO (opcional)
      if (files.iso) {
        setUploadProgress(p => ({ ...p, iso: 'updating' }));
        const isoResult = await uploadFile(files.iso, 'iso');
        grooveflixData.iso_path = isoResult.path;
        grooveflixData.iso_url = isoResult.url;
        setUploadProgress(p => ({ ...p, iso: 'done' }));
      }

      // Upload de encarte (opcional)
      if (files.booklet) {
        setUploadProgress(p => ({ ...p, booklet: 'updating' }));
        const bookletResult = await uploadFile(files.booklet, 'booklet');
        grooveflixData.booklet_path = bookletResult.path;
        grooveflixData.booklet_url = bookletResult.url;
        setUploadProgress(p => ({ ...p, booklet: 'done' }));
      }

      // Salvar no banco de dados
      const itemData = {
        title: metadata.title,
        artist: metadata.artist,
        year: metadata.year || null,
        genre: metadata.genre || null,
        status: 'disponivel',
        metadata: {
          ...(item?.metadata || {}),
          grooveflix: grooveflixData,
        },
      };

      if (item?.id) {
        // Atualizar item existente
        const { error: updateError } = await supabase
          .from('items')
          .update(itemData)
          .eq('id', item.id);

        if (updateError) throw updateError;
        toast.success('CD atualizado com sucesso!');
      } else {
        // Criar novo item
        const { data: { user } } = await supabase.auth.getUser();
        itemData.seller_id = user.id;
        itemData.price = 0;
        itemData.is_sold = false;

        const { error: insertError } = await supabase
          .from('items')
          .insert([itemData]);

        if (insertError) throw insertError;
        toast.success('CD adicionado ao Grooveflix!');
      }

      onSuccess?.();
      onClose();
      
      // Limpar estados
      setFiles({ audio: null, preview: null, iso: null, booklet: null });
      setMetadata({ title: '', artist: '', year: '', genre: '' });

    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao fazer upload', {
        description: error.message,
      });
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-charcoal-deep border border-fuchsia-500/30 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-black uppercase tracking-wider text-white">
            Adicionar ao Grooveflix
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 transition"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Categoria */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-white/60 mb-3">
              Categoria
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`p-4 rounded-2xl border text-center transition ${
                    category === cat.id
                      ? 'bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-200'
                      : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                  }`}
                >
                  <cat.icon className="w-6 h-6 mx-auto mb-2" />
                  <span className="text-xs font-black uppercase">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Metadados */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-white/60 mb-2">
                Título *
              </label>
              <input
                type="text"
                value={metadata.title}
                onChange={(e) => setMetadata(m => ({ ...m, title: e.target.value }))}
                placeholder="Nome do álbum"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:border-fuchsia-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-white/60 mb-2">
                Artista *
              </label>
              <input
                type="text"
                value={metadata.artist}
                onChange={(e) => setMetadata(m => ({ ...m, artist: e.target.value }))}
                placeholder="Nome do artista"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:border-fuchsia-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-white/60 mb-2">
                Ano
              </label>
              <input
                type="number"
                value={metadata.year}
                onChange={(e) => setMetadata(m => ({ ...m, year: e.target.value }))}
                placeholder="2024"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:border-fuchsia-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-white/60 mb-2">
                Gênero
              </label>
              <input
                type="text"
                value={metadata.genre}
                onChange={(e) => setMetadata(m => ({ ...m, genre: e.target.value }))}
                placeholder="Jazz, Funk, Soul..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:border-fuchsia-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Arquivos */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-white/60 mb-2">
                Arquivo de Áudio (MP3/FLAC/WAV) *
              </label>
              <FileUploadZone
                file={files.audio}
                onChange={(e) => handleFileSelect('audio', e)}
                icon={FileAudio}
                progress={uploadProgress.audio}
                accept="audio/*"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-white/60 mb-2">
                Preview (versão reduzida, opcional)
              </label>
              <FileUploadZone
                file={files.preview}
                onChange={(e) => handleFileSelect('preview', e)}
                icon={Music}
                progress={uploadProgress.preview}
                accept="audio/*"
              />
            </div>

            {category === 'iso' && (
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-white/60 mb-2">
                  Arquivo ISO (CD Completo)
                </label>
                <FileUploadZone
                  file={files.iso}
                  onChange={(e) => handleFileSelect('iso', e)}
                  icon={Disc}
                  progress={uploadProgress.iso}
                  accept=".iso"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-white/60 mb-2">
                Encarte/Livreto (PDF, opcional)
              </label>
              <FileUploadZone
                file={files.booklet}
                onChange={(e) => handleFileSelect('booklet', e)}
                icon={FileText}
                progress={uploadProgress.booklet}
                accept=".pdf"
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/10 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl border border-white/10 text-white/60 font-black uppercase tracking-widest text-xs hover:bg-white/5 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex-1 py-4 rounded-2xl bg-fuchsia-500 text-white font-black uppercase tracking-widest text-xs hover:bg-fuchsia-400 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="animate-spin w-4 h-4" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Adicionar ao Grooveflix
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function FileUploadZone({ file, onChange, icon: Icon, progress, accept }) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition ${
        dragOver
          ? 'border-fuchsia-500 bg-fuchsia-500/10'
          : file
          ? 'border-fuchsia-500/50 bg-fuchsia-500/5'
          : 'border-white/10 hover:border-white/20'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const dt = new DataTransfer();
        dt.files = e.dataTransfer.files;
        onChange({ target: dt });
      }}
    >
      <input
        type="file"
        accept={accept}
        onChange={onChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      
      {progress === 'updating' ? (
        <div className="flex items-center justify-center gap-2 text-fuchsia-400">
          <Loader2 className="animate-spin w-6 h-6" />
          <span className="text-sm font-medium">Enviando...</span>
        </div>
      ) : progress === 'done' ? (
        <div className="flex items-center justify-center gap-2 text-green-400">
          <CheckCircle className="w-6 h-6" />
          <span className="text-sm font-medium">Enviado!</span>
        </div>
      ) : file ? (
        <div className="flex items-center justify-center gap-3">
          <Icon className="w-8 h-8 text-fuchsia-400" />
          <div className="text-left">
            <p className="text-white font-medium text-sm">{file.name}</p>
            <p className="text-white/50 text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-white/40">
          <Icon className="w-10 h-10" />
          <p className="text-sm">Arraste ou clique para selecionar</p>
        </div>
      )}
    </div>
  );
}

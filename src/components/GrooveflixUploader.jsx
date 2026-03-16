import React, { useState } from 'react';
import { Upload, X, FileAudio, File, FileText, CheckCircle, Loader2, Music, Disc, FolderOpen, Image } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useI18n } from '../contexts/I18nContext.jsx';

const CATEGORIES = [
  { id: 'single', label: 'Single', icon: Music, description: 'Uma faixa individual' },
  { id: 'album', label: 'Álbum', icon: Disc, description: 'Pasta com todas as músicas' },
  { id: 'coletanea', label: 'Coletânea', icon: FolderOpen, description: 'Compilação de faixas' },
  { id: 'iso', label: 'ISO', icon: File, description: 'CD completo (imagem ISO)' },
];

const FILE_TYPES = {
  audio: { accept: 'audio/*', maxSize: 500 * 1024 * 1024, label: 'Áudio (MP3/FLAC/WAV)', required: true },
  folder: { accept: '', maxSize: 2000 * 1024 * 1024, label: 'Pasta com músicas', required: true },
  preview: { accept: 'audio/*', maxSize: 50 * 1024 * 1024, label: 'Preview (opcional)', required: false },
  iso: { accept: '.iso,.bin,.img', maxSize: 800 * 1024 * 1024, label: 'ISO (CD Completo)', required: false },
  booklet: { accept: '.pdf', maxSize: 50 * 1024 * 1024, label: 'Encarte/PDF (opcional)', required: false },
  cover: { accept: 'image/jpeg,.jpg,.jpeg,.png,.webp,.gif', maxSize: 10 * 1024 * 1024, label: 'Capa (imagem)', required: false },
};

export default function GrooveflixUploader({ isOpen, onClose, item, onSuccess }) {
  const { t } = useI18n();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [category, setCategory] = useState(item?.metadata?.grooveflix?.category || 'album');
  const [files, setFiles] = useState({
    audio: null,
    folder: null,
    preview: null,
    iso: null,
    booklet: null,
    cover: null,
  });
  const [metadata, setMetadata] = useState({
    title: item?.title || '',
    artist: item?.artist || '',
    year: item?.year || '',
    genre: item?.genre || '',
  });

  const handleFileSelect = (type, e) => {
    let selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const validation = FILE_TYPES[type];
    
    // Para pasta, aceita múltiplos arquivos
    if (type === 'folder') {
      if (selectedFiles.length < 2) {
        toast.error('Selecione uma pasta com pelo menos 2 músicas');
        return;
      }
      setFiles(prev => ({ ...prev, folder: selectedFiles }));
      return;
    }

    const file = selectedFiles[0];
    
    if (file.size > validation.maxSize) {
      toast.error('Arquivo muito grande', {
        description: `Máximo: ${(validation.maxSize / 1024 / 1024).toFixed(0)}MB`,
      });
      return;
    }

    setFiles(prev => ({ ...prev, [type]: file }));
  };

  const uploadToB2 = async (file, fileCategory) => {
    // Obter userId e token
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();
    const userId = user?.id || 'anon';
    const token = session?.access_token || '';
    
    // Chamar Edge Function com token JWT
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hlfirfukbrisfpebaaur.supabase.co';
    
    const response = await fetch(`${supabaseUrl}/functions/v1/b2-upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        filename: file.name,
        category: fileCategory,
        userId: userId,
        contentType: file.type || 'application/octet-stream'
      })
    });

    const data = await response.json();
    
    console.log('Upload URL response:', response.status, data);
    
    if (!response.ok || !data.uploadUrl) {
      throw new Error(data.error || data.message || `Erro ${response.status}`);
    }

    // Calcular SHA1 do arquivo
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-1', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const sha1Hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Upload direto para B2 usando POST
    const uploadResponse = await fetch(data.uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': data.uploadAuthToken,
        'Content-Type': data.contentType,
        'X-Bz-File-Name': data.filePath,
        'Content-Length': file.size.toString(),
        'X-Bz-Info-sha1': sha1Hash
      },
      body: file
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('B2 upload failed:', uploadResponse.status, errorText);
      throw new Error(`Upload falhou: ${uploadResponse.status} - ${errorText}`);
    }

    const result = await uploadResponse.json();
    return {
      fileId: result.fileId,
      fileName: result.fileName,
      filePath: data.filePath,
      contentType: file.type,
      size: file.size
    };
  };

  const handleUpload = async () => {
    if (!metadata.title || !metadata.artist) {
      toast.error('Preencha o título e artista');
      return;
    }

    // Validar conforme categoria
    if (category === 'album' && !files.folder && !files.audio) {
      toast.error('Selecione uma pasta com as músicas ou um arquivo de áudio');
      return;
    }
    
    if (category === 'single' && !files.audio) {
      toast.error('Selecione um arquivo de áudio');
      return;
    }

    if (category === 'iso' && !files.iso) {
      toast.error('Selecione um arquivo ISO');
      return;
    }

    if (!files.audio && !files.folder && !files.iso) {
      toast.error('Adicione pelo menos um arquivo de áudio ou ISO');
      return;
    }

    setUploading(true);
    setUploadProgress({});

      try {
      const grooveflixData = {
        category,
        audio_path: null,
        audio_files: [],
        preview_path: null,
        iso_path: null,
        booklet_path: null,
        cover_path: null,
      };

      // Upload de capa (opcional) - não bloqueia se falhar
      if (files.cover) {
        setUploadProgress(p => ({ ...p, cover: 'uploading' }));
        try {
          const coverResult = await uploadToB2(files.cover, 'cover');
          grooveflixData.cover_path = coverResult.filePath;
          setUploadProgress(p => ({ ...p, cover: 'done' }));
        } catch (e) {
          console.error('Cover upload error:', e);
          setUploadProgress(p => ({ ...p, cover: 'error' }));
        }
      } else {
        // Se não tem capa, usa URL externa se disponível
        grooveflixData.cover_url = metadata.coverUrl || null;
      }

      // Upload de pasta com músicas (álbum/coletânea)
      if (files.folder && files.folder.length > 0) {
        const audioFiles = [];
        for (let i = 0; i < files.folder.length; i++) {
          const file = files.folder[i];
          // Pular se não for arquivo de áudio
          if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|flac|wav|ogg|m4a|aac)$/i)) {
            continue;
          }
          
          setUploadProgress(p => ({ ...p, [`folder_${i}`]: 'uploading' }));
          try {
            const result = await uploadToB2(file, 'audio');
            audioFiles.push({
              name: file.name,
              path: result.filePath,
              size: file.size
            });
            setUploadProgress(p => ({ ...p, [`folder_${i}`]: 'done' }));
          } catch (e) {
            console.error(`Upload error for ${file.name}:`, e);
            setUploadProgress(p => ({ ...p, [`folder_${i}`]: 'error' }));
          }
        }
        grooveflixData.audio_files = audioFiles;
      }

      // Upload de áudio único (single)
      if (files.audio) {
        setUploadProgress(p => ({ ...p, audio: 'uploading' }));
        const audioResult = await uploadToB2(files.audio, 'audio');
        grooveflixData.audio_path = audioResult.filePath;
        grooveflixData.audio_files = [{ name: files.audio.name, path: audioResult.filePath, size: files.audio.size }];
        setUploadProgress(p => ({ ...p, audio: 'done' }));
      }

      // Upload de preview (opcional)
      if (files.preview) {
        setUploadProgress(p => ({ ...p, preview: 'uploading' }));
        const previewResult = await uploadToB2(files.preview, 'preview');
        grooveflixData.preview_path = previewResult.filePath;
        setUploadProgress(p => ({ ...p, preview: 'done' }));
      }

      // Upload de ISO
      if (files.iso) {
        setUploadProgress(p => ({ ...p, iso: 'uploading' }));
        const isoResult = await uploadToB2(files.iso, 'iso');
        grooveflixData.iso_path = isoResult.filePath;
        setUploadProgress(p => ({ ...p, iso: 'done' }));
      }

      // Upload de encarte (opcional)
      if (files.booklet) {
        setUploadProgress(p => ({ ...p, booklet: 'uploading' }));
        const bookletResult = await uploadToB2(files.booklet, 'booklet');
        grooveflixData.booklet_path = bookletResult.filePath;
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
        const { error: updateError } = await supabase
          .from('items')
          .update(itemData)
          .eq('id', item.id);

        if (updateError) throw updateError;
        toast.success('CD atualizado com sucesso!');
      } else {
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
      
      setFiles({ audio: null, folder: null, preview: null, iso: null, booklet: null, cover: null });
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
      
      <div className="relative w-full max-w-2xl bg-charcoal-deep border border-fuchsia-500/30 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-black uppercase tracking-wider text-white">
            Adicionar ao Grooveflix
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 transition">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
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
            {/* Capa - sempre disponível */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-white/60 mb-2">
                Capa do Álbum (imagem)
              </label>
              <FileUploadZone
                file={files.cover}
                onChange={(e) => handleFileSelect('cover', e)}
                icon={Image}
                progress={uploadProgress.cover}
                accept={FILE_TYPES.cover.accept}
                placeholder="Selecione a capa (JPEG, PNG)"
              />
            </div>

            {/* Áudio ou Pasta conforme categoria */}
            {category === 'album' || category === 'coletanea' ? (
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-white/60 mb-2">
                  Pasta com Músicas *
                </label>
                <FileUploadZone
                  file={files.folder}
                  isFolder
                  fileCount={files.folder?.length || 0}
                  onChange={(e) => handleFileSelect('folder', e)}
                  icon={FolderOpen}
                  progress={uploadProgress.folder_0}
                  accept=""
                  placeholder="Selecione a pasta com todas as músicas"
                />
              </div>
            ) : category === 'single' ? (
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-white/60 mb-2">
                  Arquivo de Áudio (MP3/FLAC/WAV) *
                </label>
                <FileUploadZone
                  file={files.audio}
                  onChange={(e) => handleFileSelect('audio', e)}
                  icon={FileAudio}
                  progress={uploadProgress.audio}
                  accept={FILE_TYPES.audio.accept}
                  placeholder="Selecione o arquivo de áudio"
                />
              </div>
            ) : null}

            {/* ISO para categoria ISO */}
            {category === 'iso' && (
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-white/60 mb-2">
                  Arquivo ISO (CD Completo) *
                </label>
                <FileUploadZone
                  file={files.iso}
                  onChange={(e) => handleFileSelect('iso', e)}
                  icon={Disc}
                  progress={uploadProgress.iso}
                  accept={FILE_TYPES.iso.accept}
                  placeholder="Selecione o arquivo ISO"
                />
              </div>
            )}

            {/* Preview (opcional) */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-white/60 mb-2">
                Preview (30-60 segundos, opcional)
              </label>
              <FileUploadZone
                file={files.preview}
                onChange={(e) => handleFileSelect('preview', e)}
                icon={Music}
                progress={uploadProgress.preview}
                accept={FILE_TYPES.preview.accept}
                placeholder="Selecione o preview"
              />
            </div>

            {/* Encarte (opcional) */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-white/60 mb-2">
                Encarte/Livreto (PDF, opcional)
              </label>
              <FileUploadZone
                file={files.booklet}
                onChange={(e) => handleFileSelect('booklet', e)}
                icon={FileText}
                progress={uploadProgress.booklet}
                accept={FILE_TYPES.booklet.accept}
                placeholder="Selecione o encarte em PDF"
              />
            </div>
          </div>

          <p className="text-xs text-white/40 text-center">
            Os arquivos são enviados diretamente para o Backblaze B2
          </p>
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

function FileUploadZone({ file, isFolder, fileCount, onChange, icon: Icon, progress, accept, placeholder }) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={`relative border-2 border-dashed rounded-2xl p-4 text-center transition ${
        dragOver
          ? 'border-fuchsia-500 bg-fuchsia-500/10'
          : file || fileCount > 0
          ? 'border-fuchsia-500/50 bg-fuchsia-500/5'
          : 'border-white/10 hover:border-white/20'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const dt = new DataTransfer();
        
        if (isFolder) {
          // Para pasta, tentar obter todos os arquivos
          const items = e.dataTransfer.items;
          if (items) {
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              if (item.kind === 'file') {
                const f = item.getAsFile();
                if (f) dt.files.push(f);
              }
            }
          }
        } else {
          dt.files = e.dataTransfer.files;
        }
        
        onChange({ target: dt });
      }}
    >
      <input
        type="file"
        accept={accept}
        onChange={onChange}
        {...(isFolder ? { webkitdirectory: '', directory: '' } : {})}
        multiple={isFolder}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      
      {progress === 'uploading' ? (
        <div className="flex items-center justify-center gap-2 text-fuchsia-400">
          <Loader2 className="animate-spin w-5 h-5" />
          <span className="text-sm">Enviando...</span>
        </div>
      ) : progress === 'done' ? (
        <div className="flex items-center justify-center gap-2 text-green-400">
          <CheckCircle className="w-5 h-5" />
          <span className="text-sm">Enviado!</span>
        </div>
      ) : progress === 'error' ? (
        <div className="flex items-center justify-center gap-2 text-red-400">
          <span className="text-sm">Erro</span>
        </div>
      ) : file || fileCount > 0 ? (
        <div className="flex items-center justify-center gap-3">
          <Icon className="w-6 h-6 text-fuchsia-400" />
          <div className="text-left">
            <p className="text-white font-medium text-sm">
              {isFolder ? `${fileCount} arquivos selecionados` : file.name}
            </p>
            {!isFolder && file && (
              <p className="text-white/50 text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-white/40 py-2">
          <Icon className="w-8 h-8" />
          <p className="text-sm">{placeholder || 'Arraste ou clique para selecionar'}</p>
        </div>
      )}
    </div>
  );
}

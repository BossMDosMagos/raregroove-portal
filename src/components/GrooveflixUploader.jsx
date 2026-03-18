import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, FileAudio, File, FileText, CheckCircle, Loader2, Music, Disc, FolderOpen, Image, Cloud, Shield, Zap, HardDrive } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useI18n } from '../contexts/I18nContext.jsx';

const CATEGORIES = [
  { id: 'single', label: 'Single', icon: Music, description: 'Uma faixa individual' },
  { id: 'album', label: 'Álbum', icon: Disc, description: 'Pasta com todas as músicas' },
  { id: 'coletanea', label: 'Coletânea', icon: FolderOpen, description: 'Compilação de faixas' },
  { id: 'iso', label: 'ISO', icon: HardDrive, description: 'CD completo (imagem ISO)' },
];

const FILE_TYPES = {
  audio: { accept: 'audio/*', maxSize: 500 * 1024 * 1024, label: 'Áudio (MP3/FLAC/WAV)', required: true },
  folder: { accept: '', maxSize: 2000 * 1024 * 1024, label: 'Pasta com músicas', required: true },
  preview: { accept: 'audio/*', maxSize: 50 * 1024 * 1024, label: 'Preview (opcional)', required: false },
  iso: { accept: '.iso,.bin,.img', maxSize: 800 * 1024 * 1024, label: 'ISO (CD Completo)', required: false },
  booklet: { accept: '.pdf', maxSize: 50 * 1024 * 1024, label: 'Encarte/PDF (opcional)', required: false },
  cover: { accept: 'image/jpeg,.jpg,.jpeg,.png,.webp,.gif', maxSize: 10 * 1024 * 1024, label: 'Capa (imagem)', required: false },
};

function FileUploadZone({ file, isFolder, fileCount, onChange, icon: Icon, progress, accept, placeholder }) {
  const [dragOver, setDragOver] = useState(false);

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div
      className={`relative border-2 border-dashed rounded-2xl p-5 transition-all duration-300 ${
        dragOver
          ? 'border-fuchsia-500 bg-fuchsia-500/10 scale-[1.02]'
          : file || fileCount > 0
          ? 'border-fuchsia-500/50 bg-fuchsia-500/5'
          : 'border-white/10 hover:border-white/20 bg-white/5'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const dt = new DataTransfer();
        if (isFolder) {
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
        <div className="flex items-center justify-center gap-3 py-4">
          <div className="relative">
            <Loader2 className="animate-spin w-8 h-8 text-fuchsia-400" />
            <div className="absolute inset-0 w-8 h-8 rounded-full border-2 border-fuchsia-500/30 animate-ping" />
          </div>
          <div>
            <p className="text-fuchsia-300 font-medium">Enviando...</p>
            <p className="text-white/40 text-xs">Aguarde enquanto processamos seu arquivo</p>
          </div>
        </div>
      ) : progress === 'done' ? (
        <div className="flex items-center justify-center gap-3 py-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-emerald-300 font-medium">Enviado com sucesso!</p>
            <p className="text-white/40 text-xs">Arquivo disponível no Grooveflix</p>
          </div>
        </div>
      ) : progress === 'error' ? (
        <div className="flex items-center justify-center gap-3 py-4">
          <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
            <X className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <p className="text-red-300 font-medium">Erro no upload</p>
            <p className="text-white/40 text-xs">Tente novamente ou entre em contato</p>
          </div>
        </div>
      ) : file || fileCount > 0 ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-purple-500/20 border border-fuchsia-500/30 flex items-center justify-center">
              <Icon className="w-7 h-7 text-fuchsia-400" />
            </div>
            <div>
              <p className="text-white font-medium">
                {isFolder ? `${fileCount} arquivos selecionados` : file.name}
              </p>
              {!isFolder && file && (
                <p className="text-white/40 text-xs mt-0.5">{formatSize(file.size)}</p>
              )}
            </div>
          </div>
          <button type="button" onClick={(e) => { e.stopPropagation(); onChange({ target: { files: [] } }); }} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Icon className="w-7 h-7 text-white/30 group-hover:text-fuchsia-400 transition-colors" />
          </div>
          <div className="text-center">
            <p className="text-white/60 font-medium">{placeholder || 'Arraste ou clique para selecionar'}</p>
            <p className="text-white/30 text-xs mt-1">Suporte para múltiplos formatos</p>
          </div>
        </div>
      )}
    </div>
  );
}

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
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hlfirfukbrisfpebaaur.supabase.co';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    
    const response = await fetch(`${supabaseUrl}/functions/v1/b2-upload-url`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey
      },
      body: JSON.stringify({
        filename: file.name,
        category: fileCategory,
        contentType: file.type || 'application/octet-stream'
      })
    });

    const data = await response.json();
    
    if (!response.ok || !data.uploadUrl) {
      throw new Error(data.error || data.message || `Erro ${response.status}`);
    }

    const { uploadUrl, uploadAuthToken, filePath, contentType } = data;
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      body: file,
      headers: {
        'Authorization': uploadAuthToken,
        'X-Bz-File-Name': encodeURIComponent(filePath),
        'Content-Type': file.type || 'b2/x-auto',
        'X-Bz-Content-Sha1': 'do_not_verify'
      }
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload falhou: ${uploadResponse.status} - ${errorText}`);
    }

    const result = await uploadResponse.json();

    return {
      fileId: result.fileId,
      fileName: result.fileName,
      filePath: filePath,
      contentType: file.type,
      size: file.size
    };
  };

  const handleUpload = async () => {
    if (!metadata.title || !metadata.artist) {
      toast.error('Preencha o título e artista');
      return;
    }

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
        grooveflixData.cover_url = metadata.coverUrl || null;
      }

      if (files.folder && files.folder.length > 0) {
        const audioFiles = [];
        for (let i = 0; i < files.folder.length; i++) {
          const file = files.folder[i];
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

      if (files.audio) {
        setUploadProgress(p => ({ ...p, audio: 'uploading' }));
        const audioResult = await uploadToB2(files.audio, 'audio');
        grooveflixData.audio_path = audioResult.filePath;
        grooveflixData.audio_files = [{ name: files.audio.name, path: audioResult.filePath, size: files.audio.size }];
        setUploadProgress(p => ({ ...p, audio: 'done' }));
      }

      if (files.preview) {
        setUploadProgress(p => ({ ...p, preview: 'uploading' }));
        const previewResult = await uploadToB2(files.preview, 'preview');
        grooveflixData.preview_path = previewResult.filePath;
        setUploadProgress(p => ({ ...p, preview: 'done' }));
      }

      if (files.iso) {
        setUploadProgress(p => ({ ...p, iso: 'uploading' }));
        const isoResult = await uploadToB2(files.iso, 'iso');
        grooveflixData.iso_path = isoResult.filePath;
        setUploadProgress(p => ({ ...p, iso: 'done' }));
      }

      if (files.booklet) {
        setUploadProgress(p => ({ ...p, booklet: 'uploading' }));
        const bookletResult = await uploadToB2(files.booklet, 'booklet');
        grooveflixData.booklet_path = bookletResult.filePath;
        setUploadProgress(p => ({ ...p, booklet: 'done' }));
      }

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
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={onClose} />
      
      <div className="relative w-full max-w-3xl bg-gradient-to-br from-charcoal-deep via-charcoal-light to-charcoal-deep border border-fuchsia-500/20 rounded-3xl shadow-2xl shadow-fuchsia-500/10 overflow-hidden max-h-[92vh] flex flex-col">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-fuchsia-500/5 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-[80px]" />
        </div>

        <div className="relative flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-purple-500/20 border border-fuchsia-500/30 flex items-center justify-center">
              <Cloud className="w-6 h-6 text-fuchsia-400" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-wider text-white">
                Adicionar ao Grooveflix
              </h2>
              <p className="text-white/40 text-xs">Upload de conteúdo Hi-Fi</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl hover:bg-white/10 transition flex items-center justify-center text-white/50 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative p-6 space-y-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-4 gap-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`group relative p-4 rounded-2xl border text-center transition-all duration-300 ${
                  category === cat.id
                    ? 'bg-fuchsia-500/20 border-fuchsia-500/50 shadow-lg shadow-fuchsia-500/10'
                    : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center transition-transform ${category === cat.id ? 'bg-fuchsia-500/30' : 'bg-white/5'}`}>
                  <cat.icon className={`w-6 h-6 ${category === cat.id ? 'text-fuchsia-300' : 'text-white/40 group-hover:text-white/70'}`} />
                </div>
                <span className={`text-xs font-black uppercase ${category === cat.id ? 'text-fuchsia-200' : ''}`}>{cat.label}</span>
                <p className={`text-[10px] mt-1 ${category === cat.id ? 'text-fuchsia-300/60' : 'text-white/30'}`}>{cat.description}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-fuchsia-300/70 ml-1">
                <Shield className="w-3 h-3" /> Título *
              </label>
              <input
                type="text"
                value={metadata.title}
                onChange={(e) => setMetadata(m => ({ ...m, title: e.target.value }))}
                placeholder="Nome do álbum"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-white/20 focus:border-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-fuchsia-300/70 ml-1">
                <Music className="w-3 h-3" /> Artista *
              </label>
              <input
                type="text"
                value={metadata.artist}
                onChange={(e) => setMetadata(m => ({ ...m, artist: e.target.value }))}
                placeholder="Nome do artista"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-white/20 focus:border-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-fuchsia-300/70 ml-1">
                <Disc className="w-3 h-3" /> Ano
              </label>
              <input
                type="number"
                value={metadata.year}
                onChange={(e) => setMetadata(m => ({ ...m, year: e.target.value }))}
                placeholder="2024"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-white/20 focus:border-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-fuchsia-300/70 ml-1">
                <Zap className="w-3 h-3" /> Gênero
              </label>
              <input
                type="text"
                value={metadata.genre}
                onChange={(e) => setMetadata(m => ({ ...m, genre: e.target.value }))}
                placeholder="Jazz, Funk, Soul..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-white/20 focus:border-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 transition-all"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/50 ml-1">
              <Upload className="w-3 h-3" /> Arquivos
            </div>
            
            <div>
              <label className="block text-xs text-white/60 mb-2">Capa do Álbum (imagem)</label>
              <FileUploadZone
                file={files.cover}
                onChange={(e) => handleFileSelect('cover', e)}
                icon={Image}
                progress={uploadProgress.cover}
                accept={FILE_TYPES.cover.accept}
                placeholder="Selecione a capa (JPEG, PNG, WebP)"
              />
            </div>

            {category === 'album' || category === 'coletanea' ? (
              <div>
                <label className="block text-xs text-white/60 mb-2">Pasta com Músicas *</label>
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
                <label className="block text-xs text-white/60 mb-2">Arquivo de Áudio (MP3/FLAC/WAV) *</label>
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

            {category === 'iso' && (
              <div>
                <label className="block text-xs text-white/60 mb-2">Arquivo ISO (CD Completo) *</label>
                <FileUploadZone
                  file={files.iso}
                  onChange={(e) => handleFileSelect('iso', e)}
                  icon={HardDrive}
                  progress={uploadProgress.iso}
                  accept={FILE_TYPES.iso.accept}
                  placeholder="Selecione o arquivo ISO"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-white/60 mb-2">Preview (30-60 segundos, opcional)</label>
              <FileUploadZone
                file={files.preview}
                onChange={(e) => handleFileSelect('preview', e)}
                icon={Music}
                progress={uploadProgress.preview}
                accept={FILE_TYPES.preview.accept}
                placeholder="Selecione o preview"
              />
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-2">Encarte/Livreto (PDF, opcional)</label>
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

          <div className="flex items-center justify-center gap-6 py-4 text-white/30 text-xs">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4" />
              <span>Backblaze B2</span>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>SSL Seguro</span>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span>Upload Rápido</span>
            </div>
          </div>
        </div>

        <div className="relative p-6 border-t border-white/10 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl border border-white/10 text-white/60 font-black uppercase tracking-widest text-xs hover:bg-white/5 hover:text-white transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex-1 relative overflow-hidden py-4 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-black uppercase tracking-widest text-xs hover:shadow-lg hover:shadow-fuchsia-500/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
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
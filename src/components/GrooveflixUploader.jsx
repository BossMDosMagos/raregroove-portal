import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Upload, X, FileAudio, FileText, CheckCircle, Loader2, Music, Disc, FolderOpen, Image, Cloud, Shield, Zap, HardDrive, Search, Check, Trash2, ExternalLink, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Database } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useI18n } from '../contexts/I18nContext.jsx';
import { useDiscogs } from '../contexts/DiscogsContext.jsx';
import { DiscogsImporter } from './DiscogsImporter.jsx';

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

  const isUploading = progress === 'uploading';
  const isDone = progress === 'done';
  const isError = progress === 'error';

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
        disabled={isUploading}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
      
      {isUploading ? (
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
      ) : isDone ? (
        <div className="flex items-center justify-center gap-3 py-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-emerald-300 font-medium">Enviado com sucesso!</p>
            <p className="text-white/40 text-xs">Arquivo disponível no Grooveflix</p>
          </div>
        </div>
      ) : isError ? (
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

function UploadFileItem({ file, index, status, progress, onRemove }) {
  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />;
      case 'done':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'error':
        return <X className="w-4 h-4 text-red-400" />;
      default:
        return <FileAudio className="w-4 h-4 text-white/40" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'uploading':
        return 'text-yellow-300';
      case 'done':
        return 'text-emerald-300';
      case 'error':
        return 'text-red-300';
      default:
        return 'text-white/50';
    }
  };

  const isUploading = status === 'uploading';

  return (
    <div className="flex items-center gap-3 py-2 px-3 bg-white/5 rounded-xl border border-white/5">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
        status === 'done' ? 'bg-emerald-500/20' :
        status === 'error' ? 'bg-red-500/20' :
        status === 'uploading' ? 'bg-yellow-500/20' :
        'bg-white/5'
      }`}>
        {getStatusIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${getStatusColor()}`} title={file.name}>
          {index + 1}. {file.name}
        </p>
        <div className="flex items-center gap-2">
          <p className="text-white/30 text-xs">{formatSize(file.size)}</p>
          {isUploading && progress !== undefined && (
            <span className="text-yellow-400/70 text-xs font-mono">{progress}%</span>
          )}
        </div>
        {isUploading && (
          <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full transition-all duration-300"
              style={{ width: `${progress || 0}%` }}
            />
          </div>
        )}
      </div>
      {!status && (
        <button
          onClick={onRemove}
          className="w-6 h-6 rounded hover:bg-white/10 flex items-center justify-center text-white/30 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function FolderUploadZone({ files, onChange, uploadProgress }) {
  const [dragOver, setDragOver] = useState(false);
  const [localFiles, setLocalFiles] = useState(() => files ? Array.from(files) : []);

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  useEffect(() => {
    if (files) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalFiles(Array.from(files));
    } else if (localFiles.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalFiles([]);
    }
  }, [files]);

  const audioFiles = localFiles.filter(f => 
    f.type.startsWith('audio/') || f.name.match(/\.(mp3|flac|wav|ogg|m4a|aac)$/i)
  );

  const handleRemoveFile = (indexToRemove) => {
    const newFiles = localFiles.filter((_, i) => i !== indexToRemove);
    setLocalFiles(newFiles);
    const dt = new DataTransfer();
    newFiles.forEach(f => dt.items.add(f));
    onChange({ target: dt });
  };

  return (
    <div className="space-y-4">
      <div
        className={`relative border-2 border-dashed rounded-2xl p-6 transition-all duration-300 ${
          dragOver
            ? 'border-fuchsia-500 bg-fuchsia-500/10 scale-[1.02]'
            : files && audioFiles.length > 0
            ? 'border-fuchsia-500/50 bg-fuchsia-500/5'
            : 'border-white/10 hover:border-white/20 bg-white/5'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const dt = new DataTransfer();
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
          onChange({ target: dt });
        }}
      >
        <input
          type="file"
          accept="audio/*,.mp3,.flac,.wav,.ogg,.m4a,.aac"
          onChange={onChange}
          webkitdirectory=""
          directory=""
          multiple
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        {audioFiles.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-purple-500/20 border border-fuchsia-500/30 flex items-center justify-center">
                  <FolderOpen className="w-6 h-6 text-fuchsia-400" />
                </div>
                <div>
                  <p className="text-white font-medium">{audioFiles.length} músicas selecionadas</p>
                  <p className="text-white/40 text-xs">
                    {formatSize(audioFiles.reduce((acc, f) => acc + f.size, 0))} total
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onChange({ target: { files: [] } }); }}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {audioFiles.slice(0, 20).map((file, index) => (
                <UploadFileItem
                  key={`${file.name}-${index}`}
                  file={file}
                  index={index}
                  status={uploadProgress?.[`folder_${index}`]}
                  progress={uploadProgress?.[`folder_${index}_progress`]}
                  onRemove={() => handleRemoveFile(index)}
                />
              ))}
              {audioFiles.length > 20 && (
                <p className="text-white/30 text-xs text-center py-2">
                  ... e mais {audioFiles.length - 20} arquivos
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FolderOpen className="w-7 h-7 text-white/30 group-hover:text-fuchsia-400 transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-white/60 font-medium">Selecione uma pasta com músicas</p>
              <p className="text-white/30 text-xs mt-1">MP3, FLAC, WAV, OGG, M4A, AAC</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TracklistEditor({ tracklist, onUpdateTrack, onRemoveTrack, onAddTrack }) {
  if (!tracklist || tracklist.length === 0) {
    return (
      <div className="text-center py-4 text-white/30">
        <Music className="w-6 h-6 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Sem tracklist - pode adicionar manualmente</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-fuchsia-300 font-medium uppercase tracking-wider">
          {tracklist.length} faixas {tracklist.length > 0 ? '(do Discogs)' : ''}
        </p>
        <button
          onClick={onAddTrack}
          className="text-xs text-fuchsia-400 hover:text-fuchsia-300 flex items-center gap-1"
        >
          <span className="text-lg">+</span> Adicionar faixa
        </button>
      </div>
      
      <div className="max-h-64 overflow-y-auto space-y-1.5">
        {tracklist.map((track, index) => (
          <div key={index} className="flex items-center gap-2 bg-white/5 rounded-lg p-2 group">
            <span className="w-8 text-center text-xs text-white/30 font-mono">
              {track.position || index + 1}
            </span>
            <input
              type="text"
              value={track.title}
              onChange={(e) => onUpdateTrack(index, 'title', e.target.value)}
              className="flex-1 bg-transparent border-none text-sm text-white/80 focus:outline-none focus:text-white"
              placeholder="Título da faixa"
            />
            <input
              type="text"
              value={track.duration || ''}
              onChange={(e) => onUpdateTrack(index, 'duration', e.target.value)}
              className="w-14 bg-transparent border-none text-xs text-white/40 font-mono focus:outline-none focus:text-white/60 text-right"
              placeholder="0:00"
            />
            <button
              onClick={() => onRemoveTrack(index)}
              className="w-6 h-6 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 flex items-center justify-center text-white/30 hover:text-red-400 transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SuperCard({ 
  metadata, 
  setMetadata, 
  tracklist, 
  setTracklist, 
  discogsData,
  clearDiscogs,
  files,
  handleFileSelect,
  uploadProgress,
  category,
  setCategory,
  CATEGORIES,
  onAddTrack,
  onUpdateTrack,
  onRemoveTrack,
  onOpenDiscogs,
  showDiscogsButton,
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      {showDiscogsButton && (
        <div className="border border-dashed border-fuchsia-500/30 rounded-2xl p-4 bg-fuchsia-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-purple-500/20 border border-fuchsia-500/30 flex items-center justify-center">
                <Database className="w-5 h-5 text-fuchsia-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Importar do Discogs</p>
                <p className="text-xs text-white/40">Busca automática de álbum, artista, capa e tracklist</p>
              </div>
            </div>
            <button
              onClick={onOpenDiscogs}
              className="px-4 py-2 bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700 text-white font-bold rounded-xl text-sm transition-all flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Buscar Discogs
            </button>
          </div>
        </div>
      )}

      {discogsData && (
        <div className="flex items-center justify-between bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/30 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-medium text-emerald-200">
              Sincronizado com Discogs
            </span>
          </div>
          {discogsData.discogsId && (
            <div className="flex items-center gap-2">
              <a
                href={`https://www.discogs.com/release/${discogsData.discogsId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white/40 hover:text-fuchsia-300 flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                Ver no Discogs
              </a>
              <button
                onClick={clearDiscogs}
                className="text-xs text-white/40 hover:text-red-400 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Limpar
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-white/5 border border-white/10">
            {metadata.coverUrl ? (
              <>
                <img
                  src={metadata.coverUrl}
                  alt={metadata.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    const img = e.target;
                    const parent = img.parentElement;
                    
                    if (!img.dataset.fallbackAttempted) {
                      img.dataset.fallbackAttempted = 'true';
                      
                      if (img.crossOrigin !== 'anonymous') {
                        img.crossOrigin = 'anonymous';
                        img.src = metadata.coverUrl + (metadata.coverUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
                        return;
                      }
                    }
                    
                    img.style.display = 'none';
                    const fallback = parent.querySelector('.fallback-placeholder');
                    if (fallback) {
                      fallback.classList.remove('hidden');
                      const fallbackImg = fallback.querySelector('img');
                      if (fallbackImg) fallbackImg.style.display = 'flex';
                    }
                  }}
                />
                <div className="fallback-placeholder hidden w-full h-full flex-col items-center justify-center text-white/30 absolute inset-0 bg-black/50">
                  <img 
                    src="/images/vinyl-generic.svg" 
                    alt="Vinil genérico" 
                    className="w-24 h-24 mb-2 opacity-20 hidden"
                    style={{ display: 'flex' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <Disc className="w-16 h-16 mb-2 opacity-30" />
                  <p className="text-sm">CORS/Auth error</p>
                  <button
                    onClick={() => document.getElementById('cover-input')?.click()}
                    className="mt-2 text-xs text-fuchsia-400 hover:text-fuchsia-300"
                  >
                    Selecionar imagem local
                  </button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <p className="text-xs text-emerald-300 font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Capa do Discogs
                  </p>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-white/30 cursor-pointer hover:bg-white/5 transition" onClick={() => document.getElementById('cover-input')?.click()}>
                <Disc className="w-16 h-16 mb-2 opacity-30" />
                <p className="text-sm">Clique para adicionar capa</p>
                <input
                  id="cover-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const localUrl = URL.createObjectURL(file);
                      setMetadata(m => ({ ...m, coverUrl: localUrl }));
                    }
                  }}
                />
              </div>
            )}
          </div>

          {discogsData?.labels && (
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Gravadora</p>
              <p className="text-sm text-white/80">{discogsData.labels}</p>
              {discogsData.catalogNumber && (
                <p className="text-xs text-white/40 mt-1">Catálogo: {discogsData.catalogNumber}</p>
              )}
            </div>
          )}

          {discogsData?.formats && (
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Formato</p>
              <p className="text-sm text-white/80">{discogsData.formats}</p>
              {discogsData.country && (
                <p className="text-xs text-white/40 mt-1">País: {discogsData.country}</p>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-fuchsia-300/70 ml-1">
                <Shield className="w-3 h-3" /> Título *
              </label>
              <input
                type="text"
                value={metadata.title}
                onChange={(e) => setMetadata(m => ({ ...m, title: e.target.value }))}
                placeholder="Nome do álbum"
                className="w-full bg-white/5 border border-fuchsia-500/30 rounded-xl px-4 py-3.5 text-white placeholder:text-white/20 focus:border-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 transition-all"
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
                className="w-full bg-white/5 border border-fuchsia-500/30 rounded-xl px-4 py-3.5 text-white placeholder:text-white/20 focus:border-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 transition-all"
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
                className="w-full bg-white/5 border border-fuchsia-500/30 rounded-xl px-4 py-3.5 text-white placeholder:text-white/20 focus:border-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 transition-all"
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
                className="w-full bg-white/5 border border-fuchsia-500/30 rounded-xl px-4 py-3.5 text-white placeholder:text-white/20 focus:border-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 transition-all"
              />
            </div>
          </div>

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

          <div className="bg-white/5 rounded-xl p-4">
            <TracklistEditor
              tracklist={tracklist}
              onUpdateTrack={onUpdateTrack}
              onRemoveTrack={onRemoveTrack}
              onAddTrack={onAddTrack}
            />
          </div>

          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/50 ml-1">
              <Upload className="w-3 h-3 inline mr-1" /> Arquivos de Áudio
            </p>
            {category === 'album' || category === 'coletanea' ? (
              <FolderUploadZone
                files={files.folder}
                onChange={(e) => handleFileSelect('folder', e)}
                uploadProgress={uploadProgress}
              />
            ) : (
              <FileUploadZone
                file={files.audio}
                onChange={(e) => handleFileSelect('audio', e)}
                icon={FileAudio}
                progress={uploadProgress.audio}
                accept={FILE_TYPES.audio.accept}
                placeholder="Selecione o arquivo de áudio"
              />
            )}
          </div>

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
        </div>
      </div>
    </div>
  );
}

function DiscogsSearchModal({ isOpen, onClose, onImport, setMetadata, setTracklist }) {
  const { t } = useI18n();
  const { hasImported, importedData } = useDiscogs();

  useEffect(() => {
    if (hasImported && importedData && isOpen) {
      if (onImport) {
        onImport(importedData);
      }
      if (setMetadata) {
        setMetadata(prev => ({
          ...prev,
          title: importedData.title || prev.title,
          artist: importedData.artist || prev.artist,
          year: importedData.year || prev.year,
          genre: importedData.genre || prev.genre,
          coverUrl: importedData.coverUrl || prev.coverUrl,
          coverUrlThumbnail: importedData.coverUrlThumbnail || prev.coverUrlThumbnail,
          discogsId: importedData.discogsId || prev.discogsId,
          discogsMasterId: importedData.discogsMasterId || prev.discogsMasterId,
          country: importedData.country || prev.country,
          labels: importedData.labels || prev.labels,
          catalogNumber: importedData.catalogNumber || prev.catalogNumber,
          formats: importedData.formats || prev.formats,
          description: importedData.description || prev.description,
        }));
      }
      if (setTracklist) {
        setTracklist(importedData.tracklist || []);
      }
      onClose();
    }
  }, [hasImported, importedData, isOpen, onClose, onImport, setMetadata, setTracklist]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-gradient-to-br from-charcoal-deep via-charcoal-light to-charcoal-deep border border-fuchsia-500/20 rounded-3xl shadow-2xl shadow-fuchsia-500/10 overflow-hidden max-h-[85vh] flex flex-col">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-fuchsia-500/5 rounded-full blur-[100px]" />
        </div>

        <div className="relative flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-purple-500/20 border border-fuchsia-500/30 flex items-center justify-center">
              <Database className="w-6 h-6 text-fuchsia-400" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-wider text-white">
                Importar do Discogs
              </h2>
              <p className="text-white/40 text-xs">Busca automática de metadados</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl hover:bg-white/10 transition flex items-center justify-center text-white/50 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative p-6 overflow-y-auto flex-1">
          <DiscogsImporter />
        </div>
      </div>
    </div>
  );
}

export default function GrooveflixUploader({ isOpen, onClose, item, onSuccess, isAdmin, userId }) {
  const { t } = useI18n();
  const { importedData, hasImported, clearImportedData, updateImportedTrack } = useDiscogs();
  const [showDiscogsModal, setShowDiscogsModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const CATEGORIES = [
    { id: 'single', label: t('grooveflix.upload.category.single') || 'Single', icon: Music, description: t('grooveflix.upload.category.singleDesc') || 'Uma faixa individual' },
    { id: 'album', label: t('grooveflix.upload.category.album') || 'Álbum', icon: Disc, description: t('grooveflix.upload.category.albumDesc') || 'Pasta com todas as músicas' },
    { id: 'coletanea', label: t('grooveflix.upload.category.compilation') || 'Coletânea', icon: FolderOpen, description: t('grooveflix.upload.category.compilationDesc') || 'Compilação de faixas' },
    { id: 'iso', label: 'ISO', icon: HardDrive, description: t('grooveflix.upload.category.isoDesc') || 'CD completo (imagem ISO)' },
  ];
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
    coverUrl: item?.metadata?.grooveflix?.coverUrl || '',
    coverUrlThumbnail: item?.metadata?.grooveflix?.coverUrlThumbnail || '',
    discogsId: item?.metadata?.grooveflix?.discogsId || '',
    discogsMasterId: item?.metadata?.grooveflix?.discogsMasterId || '',
    country: item?.metadata?.grooveflix?.country || '',
    labels: item?.metadata?.grooveflix?.labels || '',
    catalogNumber: item?.metadata?.grooveflix?.catalogNumber || '',
    formats: item?.metadata?.grooveflix?.formats || '',
    description: item?.metadata?.grooveflix?.description || '',
  });
  const [tracklist, setTracklist] = useState(item?.metadata?.grooveflix?.tracklist || []);

  useEffect(() => {
    if (hasImported && importedData) {
      setMetadata(prev => ({
        ...prev,
        title: importedData.title || prev.title,
        artist: importedData.artist || prev.artist,
        year: importedData.year || prev.year,
        genre: importedData.genre || prev.genre,
        coverUrl: importedData.coverUrl || prev.coverUrl,
        coverUrlThumbnail: importedData.coverUrlThumbnail || prev.coverUrlThumbnail,
        discogsId: importedData.discogsId || prev.discogsId,
        discogsMasterId: importedData.discogsMasterId || prev.discogsMasterId,
        country: importedData.country || prev.country,
        labels: importedData.labels || prev.labels,
        catalogNumber: importedData.catalogNumber || prev.catalogNumber,
        formats: importedData.formats || prev.formats,
        description: importedData.description || prev.description,
      }));
      setTracklist(importedData.tracklist || []);
    }
  }, [hasImported, importedData]);

  useEffect(() => {
    if (showDiscogsModal && importedData) {
      setMetadata(prev => ({
        ...prev,
        title: importedData.title || prev.title,
        artist: importedData.artist || prev.artist,
        year: importedData.year || prev.year,
        genre: importedData.genre || prev.genre,
        coverUrl: importedData.coverUrl || prev.coverUrl,
        coverUrlThumbnail: importedData.coverUrlThumbnail || prev.coverUrlThumbnail,
        discogsId: importedData.discogsId || prev.discogsId,
        discogsMasterId: importedData.discogsMasterId || prev.discogsMasterId,
        country: importedData.country || prev.country,
        labels: importedData.labels || prev.labels,
        catalogNumber: importedData.catalogNumber || prev.catalogNumber,
        formats: importedData.formats || prev.formats,
        description: importedData.description || prev.description,
      }));
      setTracklist(importedData.tracklist || []);
    }
  }, [showDiscogsModal, importedData]);

  const handleFileSelect = (type, e) => {
    let selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const validation = FILE_TYPES[type];
    
    if (type === 'folder') {
      if (selectedFiles.length < 2) {
        toast.error(t('grooveflix.upload.minFiles'));
        return;
      }
      setFiles(prev => ({ ...prev, folder: selectedFiles }));
      return;
    }
    
    const file = selectedFiles[0];
    
    if (file.size > validation.maxSize) {
      toast.error(t('grooveflix.upload.fileTooBig'), {
        description: `${t('grooveflix.upload.maxSize')}: ${(validation.maxSize / 1024 / 1024).toFixed(0)}MB`,
      });
      return;
    }

    if (type === 'cover') {
      const localUrl = URL.createObjectURL(file);
      setMetadata(prev => ({ ...prev, coverUrl: localUrl }));
    }

    setFiles(prev => ({ ...prev, [type]: file }));
  };

  const uploadToB2 = async (file, fileCategory, itemId, discNumber = null, onProgress = null) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hlfirfukbrisfpebaaur.supabase.co';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token || supabaseAnonKey;
    const currentUserId = session?.user?.id || (await supabase.auth.getUser()).data.user?.id;
    
    const formData = new FormData();
    formData.append('filename', file.name);
    formData.append('category', fileCategory);
    formData.append('userId', currentUserId);
    formData.append('itemId', itemId);
    formData.append('file', file);
    if (discNumber !== null) {
      formData.append('discNumber', String(discNumber));
    }
    
    const response = await fetch(`${supabaseUrl}/functions/v1/b2-upload-url`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'apikey': supabaseAnonKey
      },
      body: formData
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || data.message || `Erro ${response.status}`);
    }

    if (data.success) {
      return {
        fileId: data.fileId,
        fileName: data.fileName,
        filePath: data.filePath,
        downloadUrl: data.downloadUrl,
        size: file.size
      };
    }
    
    if (data.uploadUrl) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', data.uploadUrl, true);
        xhr.setRequestHeader('Authorization', data.uploadAuthToken);
        xhr.setRequestHeader('X-Bz-File-Name', encodeURIComponent(data.filePath));
        xhr.setRequestHeader('Content-Type', file.type || 'b2/x-auto');
        xhr.setRequestHeader('X-Bz-Content-Sha1', 'do_not_verify');
        
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        };
        
        xhr.onload = () => {
          if (xhr.status === 200) {
            try {
              const result = JSON.parse(xhr.responseText);
              resolve({
                fileId: result.fileId,
                fileName: result.fileName,
                filePath: data.filePath,
                size: file.size
              });
            } catch (e) {
              reject(new Error('Erro ao parsear resposta'));
            }
          } else {
            reject(new Error(`Upload falhou: ${xhr.status}`));
          }
        };
        
        xhr.onerror = () => reject(new Error('Erro de rede'));
        xhr.send(file);
      });
    }

    throw new Error('Resposta inválida do servidor');
  };

  const handleUpload = async () => {
    if (!metadata.title || !metadata.artist) {
      toast.error(t('grooveflix.upload.titleRequired') || 'Preencha o título e artista');
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
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user.id;
      
      const itemData = {
        title: metadata.title,
        artist: metadata.artist,
        year: metadata.year || null,
        genre: metadata.genre || null,
        status: 'disponivel',
        seller_id: currentUserId,
        price: 0,
        is_sold: false,
        metadata: {
          ...(item?.metadata || {}),
          grooveflix: {
            category,
            audio_path: null,
            audio_files: [],
            preview_path: null,
            iso_path: null,
            booklet_path: null,
            cover_path: null,
            coverUrl: metadata.coverUrl || null,
            discogsId: metadata.discogsId || null,
            discogsMasterId: metadata.discogsMasterId || null,
            country: metadata.country || null,
            labels: metadata.labels || null,
            catalogNumber: metadata.catalogNumber || null,
            formats: metadata.formats || null,
            tracklist: tracklist || [],
            description: metadata.description || null,
            isAlbum: true,
          },
          source: 'grooveflix',
        },
      };

      let itemId = item?.id;
      
      if (!itemId) {
        const { data: insertedItem, error: insertError } = await supabase
          .from('items')
          .insert([itemData])
          .select('id')
          .single();

        if (insertError) throw insertError;
        itemId = insertedItem.id;
      }

      const grooveflixData = {
        ...((item?.metadata?.grooveflix) || (itemData.metadata?.grooveflix) || {}),
        discogsId: metadata.discogsId || item?.metadata?.grooveflix?.discogsId || null,
        discogsMasterId: metadata.discogsMasterId || item?.metadata?.grooveflix?.discogsMasterId || null,
        country: metadata.country || item?.metadata?.grooveflix?.country || null,
        labels: metadata.labels || item?.metadata?.grooveflix?.labels || null,
        catalogNumber: metadata.catalogNumber || item?.metadata?.grooveflix?.catalogNumber || null,
        formats: metadata.formats || item?.metadata?.grooveflix?.formats || null,
        tracklist: tracklist?.length > 0 ? tracklist : (item?.metadata?.grooveflix?.tracklist || []),
        description: metadata.description || item?.metadata?.grooveflix?.description || null,
        isAlbum: true,
      };

      if (files.folder && files.folder.length > 0) {
        const audioFiles = [];
        for (let i = 0; i < files.folder.length; i++) {
          const file = files.folder[i];
          if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|flac|wav|ogg|m4a|aac)$/i)) {
            continue;
          }
          
          setUploadProgress(p => ({ ...p, [`folder_${i}`]: 'uploading', [`folder_${i}_progress`]: 0 }));
          try {
            let discNumber = 1;
            const discMatch = file.name.match(/^(\d+)-/);
            if (discMatch) {
              discNumber = parseInt(discMatch[1], 10);
            }
            const result = await uploadToB2(file, 'audio', itemId, discNumber, (progress) => {
              setUploadProgress(p => ({ ...p, [`folder_${i}_progress`]: progress }));
            });
            audioFiles.push({
              name: file.name,
              path: result.filePath,
              size: file.size,
              discNumber
            });
            setUploadProgress(p => ({ ...p, [`folder_${i}`]: 'done', [`folder_${i}_progress`]: 100 }));
          } catch (e) {
            toast.error(`Erro no upload de ${file.name}`, { description: e.message });
            setUploadProgress(p => ({ ...p, [`folder_${i}`]: 'error' }));
          }
        }
        
        if (audioFiles.length === 0 && files.folder.length > 0) {
          toast.error('Nenhum áudio foi enviado com sucesso');
        }
        grooveflixData.audio_files = audioFiles;
        
        if (audioFiles.length > 0) {
          grooveflixData.audio_path = audioFiles[0].path;
        }
      }

      if (files.audio) {
        setUploadProgress(p => ({ ...p, audio: 'uploading' }));
        try {
          const audioResult = await uploadToB2(files.audio, 'audio', itemId);
          grooveflixData.audio_path = audioResult.filePath;
          grooveflixData.audio_files = [{ name: files.audio.name, path: audioResult.filePath, size: files.audio.size }];
          setUploadProgress(p => ({ ...p, audio: 'done' }));
        } catch (e) {
          toast.error(t('grooveflix.upload.audioError'), { description: e.message });
          setUploadProgress(p => ({ ...p, audio: 'error' }));
        }
      }

      if (files.preview) {
        setUploadProgress(p => ({ ...p, preview: 'uploading' }));
        try {
          const previewResult = await uploadToB2(files.preview, 'preview', itemId);
          grooveflixData.preview_path = previewResult.filePath;
          setUploadProgress(p => ({ ...p, preview: 'done' }));
        } catch (e) {
          setUploadProgress(p => ({ ...p, preview: 'error' }));
        }
      }

      if (files.iso) {
        setUploadProgress(p => ({ ...p, iso: 'uploading' }));
        try {
          const isoResult = await uploadToB2(files.iso, 'iso', itemId);
          grooveflixData.iso_path = isoResult.filePath;
          setUploadProgress(p => ({ ...p, iso: 'done' }));
        } catch (e) {
          setUploadProgress(p => ({ ...p, iso: 'error' }));
        }
      }

      if (files.booklet) {
        setUploadProgress(p => ({ ...p, booklet: 'uploading' }));
        try {
          const bookletResult = await uploadToB2(files.booklet, 'booklet', itemId);
          grooveflixData.booklet_path = bookletResult.filePath;
          setUploadProgress(p => ({ ...p, booklet: 'done' }));
        } catch (e) {
          setUploadProgress(p => ({ ...p, booklet: 'error' }));
        }
      }

      const { error: updateError } = await supabase
        .from('items')
        .update({ metadata: { ...item?.metadata, source: 'grooveflix', grooveflix: grooveflixData } })
        .eq('id', itemId);

      if (updateError) throw updateError;
      
      toast.success(item?.id ? t('grooveflix.upload.updated') : t('grooveflix.upload.success'));

      clearImportedData();
      onSuccess?.();
      onClose();
      
      setFiles({ audio: null, folder: null, preview: null, iso: null, booklet: null, cover: null });
      setMetadata({ title: '', artist: '', year: '', genre: '', coverUrl: '', discogsId: '', discogsMasterId: '', country: '', labels: '', catalogNumber: '', formats: '', description: '' });
      setTracklist([]);

    } catch (error) {
      toast.error(t('grooveflix.upload.generalError'), {
        description: error.message,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClearDiscogs = () => {
    clearImportedData();
    setMetadata({ title: '', artist: '', year: '', genre: '', coverUrl: '', discogsId: '', discogsMasterId: '', country: '', labels: '', catalogNumber: '', formats: '', description: '' });
    setTracklist([]);
  };

  const handleUpdateTrack = (index, field, value) => {
    const newTracklist = [...tracklist];
    newTracklist[index] = { ...newTracklist[index], [field]: value };
    setTracklist(newTracklist);
    updateImportedTrack(index, field, value);
  };

  const handleRemoveTrack = (index) => {
    const newTracklist = tracklist.filter((_, i) => i !== index);
    setTracklist(newTracklist);
  };

  const handleAddTrack = () => {
    const newTrack = { position: String(tracklist.length + 1), title: '', duration: '' };
    setTracklist([...tracklist, newTrack]);
  };

  const handleCloseAttempt = () => {
    if (uploading) {
      if (window.confirm('Upload em curso. Deseja cancelar o envio do acervo?')) {
        setUploading(false);
        onClose();
      }
    } else {
      onClose();
    }
  };

  const totalFiles = files.folder ? Array.from(files.folder).filter(f => 
    f.type.startsWith('audio/') || f.name.match(/\.(mp3|flac|wav|ogg|m4a|aac)$/i)
  ).length : (files.audio ? 1 : 0) + (files.preview ? 1 : 0) + (files.iso ? 1 : 0) + (files.booklet ? 1 : 0);
  
  const completedFiles = Object.entries(uploadProgress).filter(([key, val]) => 
    key.includes('folder_') && !key.includes('_progress') && val === 'done'
  ).length + (uploadProgress.audio === 'done' ? 1 : 0) + (uploadProgress.preview === 'done' ? 1 : 0) + (uploadProgress.iso === 'done' ? 1 : 0) + (uploadProgress.booklet === 'done' ? 1 : 0);
  
  const uploadingFiles = Object.entries(uploadProgress).filter(([key, val]) => 
    key.includes('folder_') && !key.includes('_progress') && val === 'uploading'
  ).length + (uploadProgress.audio === 'uploading' ? 1 : 0) + (uploadProgress.preview === 'uploading' ? 1 : 0) + (uploadProgress.iso === 'uploading' ? 1 : 0) + (uploadProgress.booklet === 'uploading' ? 1 : 0);
  
  const globalProgress = totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0;

  if (!isOpen) return null;

  return (
    <>
      <DiscogsSearchModal 
        isOpen={showDiscogsModal} 
        onClose={() => setShowDiscogsModal(false)}
        setMetadata={setMetadata}
        setTracklist={setTracklist}
      />
      
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={handleCloseAttempt} />
        
        <div className="relative w-full max-w-5xl bg-gradient-to-br from-charcoal-deep via-charcoal-light to-charcoal-deep border border-fuchsia-500/20 rounded-3xl shadow-2xl shadow-fuchsia-500/10 overflow-hidden max-h-[95vh] flex flex-col">
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
            <SuperCard
              metadata={metadata}
              setMetadata={setMetadata}
              tracklist={tracklist}
              setTracklist={setTracklist}
              discogsData={importedData}
              clearDiscogs={handleClearDiscogs}
              files={files}
              handleFileSelect={handleFileSelect}
              uploadProgress={uploadProgress}
              category={category}
              setCategory={setCategory}
              CATEGORIES={CATEGORIES}
              onAddTrack={handleAddTrack}
              onUpdateTrack={handleUpdateTrack}
              onRemoveTrack={handleRemoveTrack}
              onOpenDiscogs={() => setShowDiscogsModal(true)}
              showDiscogsButton={isAdmin}
            />
          </div>

          {uploading && (
            <div className="relative px-6 py-4 bg-black/50 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-yellow-400" />
                  Enviando {completedFiles + uploadingFiles} de {totalFiles} arquivos...
                </span>
                <span className="text-sm font-mono text-yellow-400">{globalProgress}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full transition-all duration-300"
                  style={{ width: `${globalProgress}%` }}
                />
              </div>
            </div>
          )}
          
          <div className="relative p-6 border-t border-white/10 flex gap-4">
            <button
              onClick={handleCloseAttempt}
              disabled={uploading}
              className="flex-1 py-4 rounded-2xl border border-white/10 text-white/60 font-black uppercase tracking-widest text-xs hover:bg-white/5 hover:text-white transition disabled:opacity-50"
            >
              {uploading ? 'Aguarde...' : 'Cancelar'}
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="flex-1 relative overflow-hidden py-4 rounded-2xl bg-gradient-to-r from-yellow-600 to-yellow-500 text-white font-black uppercase tracking-widest text-xs hover:shadow-lg hover:shadow-yellow-500/20 transition disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin w-4 h-4" />
                  Enviando acervo...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  {t('grooveflix.upload.submit') || 'Adicionar ao Grooveflix'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

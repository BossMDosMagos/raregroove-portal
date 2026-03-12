import React, { useEffect, useMemo, useState } from 'react';
import { Upload, Link2, Loader2, Shield, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function safeFilename(name) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  const idx = raw.lastIndexOf('.');
  if (idx <= 0 || idx === raw.length - 1) return slugify(raw) || raw;
  const base = raw.slice(0, idx);
  const ext = raw.slice(idx + 1);
  const cleanBase = slugify(base) || base;
  const cleanExt = slugify(ext) || ext;
  return `${cleanBase}.${cleanExt}`;
}

async function getBearer() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ? String(session.access_token) : '';
  return token ? `Bearer ${token}` : '';
}

async function apiPost(path, body) {
  const bearer = await getBearer();
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      authorization: bearer,
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const base = String(data?.message || data?.error || res.statusText || 'Erro');
    const details = data?.body ? ` • ${String(data.body).slice(0, 280)}` : '';
    const err = new Error(`${base}${details}`);
    err.code = data?.error || null;
    throw err;
  }
  return data;
}

async function apiGet(path) {
  const bearer = await getBearer();
  const res = await fetch(path, {
    method: 'GET',
    headers: { authorization: bearer },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const base = String(data?.message || data?.error || res.statusText || 'Erro');
    const details = data?.body ? ` • ${String(data.body).slice(0, 280)}` : '';
    const err = new Error(`${base}${details}`);
    err.code = data?.error || null;
    throw err;
  }
  return data;
}

async function multipartUpload({ file, key, contentType, onProgress }) {
  const { upload_id } = await apiPost('/api/b2-multipart/start', { key, content_type: contentType });
  const partSize = 10 * 1024 * 1024;
  const totalParts = Math.max(1, Math.ceil(file.size / partSize));
  const parts = [];

  for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
    const start = (partNumber - 1) * partSize;
    const end = Math.min(file.size, partNumber * partSize);
    const chunk = file.slice(start, end);
    const { url } = await apiPost('/api/b2-multipart/presign', { key, upload_id, part_number: partNumber });
    let res;
    try {
      res = await fetch(url, { method: 'PUT', body: chunk });
    } catch (e) {
      const msg = e?.message || String(e);
      throw new Error(`Falha de rede/CORS no upload (parte ${partNumber}). Verifique CORS no Backblaze (AllowMethods: PUT, GET, HEAD; AllowHeaders: *; ExposeHeaders: ETag; Origin: seu domínio). Detalhe: ${msg}`);
    }
    if (!res.ok) throw new Error(`Falha ao enviar parte ${partNumber}`);
    const etag = String(res.headers.get('etag') || '').replace(/"/g, '');
    if (!etag) throw new Error(`ETag ausente na parte ${partNumber} (verifique CORS: ExposeHeaders precisa incluir ETag)`);
    parts.push({ partNumber, etag });
    onProgress?.(partNumber, totalParts);
  }

  await apiPost('/api/b2-multipart/complete', { key, upload_id, parts });
}

export default function AdminUpload() {
  const [tab, setTab] = useState('upload');
  const [category, setCategory] = useState('');
  const [artist, setArtist] = useState('');
  const [itemName, setItemName] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [mainFile, setMainFile] = useState(null);
  const [bookletFile, setBookletFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);

  const [prefix, setPrefix] = useState('content/');
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [objects, setObjects] = useState([]);
  const [objectsQuery, setObjectsQuery] = useState('');
  const [selectedAudioKey, setSelectedAudioKey] = useState('');
  const [selectedIsoKey, setSelectedIsoKey] = useState('');
  const [selectedBookletKey, setSelectedBookletKey] = useState('');

  const normalizedCategory = useMemo(() => {
    const c = String(category || '').trim().toLowerCase();
    if (c === 'single') return 'single';
    if (c === 'coletanea') return 'coletanea';
    if (c === 'iso') return 'iso';
    return '';
  }, [category]);

  const destinationBase = useMemo(() => {
    if (!normalizedCategory || !artist || !itemName) return '';
    const a = slugify(artist);
    const i = slugify(itemName);
    return `content/${normalizedCategory}/${a}/${i}`;
  }, [artist, itemName, normalizedCategory]);

  const filteredObjects = useMemo(() => {
    const term = String(objectsQuery || '').trim().toLowerCase();
    if (!term) return objects;
    return (objects || []).filter((o) => String(o.key || '').toLowerCase().includes(term));
  }, [objects, objectsQuery]);

  const createItemRow = async ({ audioPath, isoPath, bookletPath, categoryValue }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) throw new Error('Sessão expirada');

    const gf = {
      category: categoryValue,
      audio_path: audioPath || null,
      iso_path: isoPath || null,
      booklet_path: bookletPath || null,
    };

    const payload = {
      title: itemName,
      artist,
      price: 0,
      condition: 'MINT',
      image_url: coverUrl || '',
      allow_sale: false,
      allow_swap: false,
      seller_id: user.id,
      metadata: { grooveflix: gf },
    };

    const { error } = await supabase.from('items').insert([payload]);
    if (error) throw error;
  };

  const uploadNew = async () => {
    if (!destinationBase) {
      toast.error('CAMPOS OBRIGATÓRIOS', { description: 'Categoria, artista e nome do item são obrigatórios.' });
      return;
    }
    if (!mainFile) {
      toast.error('ARQUIVO OBRIGATÓRIO', { description: 'Selecione o arquivo principal.' });
      return;
    }

    setBusy(true);
    setProgress({ part: 0, total: 0, label: 'Iniciando...' });
    try {
      const mainKey = `${destinationBase}/${safeFilename(mainFile.name) || mainFile.name}`;
      const isIso = normalizedCategory === 'iso';

      await multipartUpload({
        file: mainFile,
        key: mainKey,
        contentType: mainFile.type || 'application/octet-stream',
        onProgress: (p, t) => setProgress({ part: p, total: t, label: 'Enviando arquivo principal...' }),
      });

      let bookletKey = null;
      if (bookletFile) {
        bookletKey = `${destinationBase}/${safeFilename(bookletFile.name) || bookletFile.name}`;
        await multipartUpload({
          file: bookletFile,
          key: bookletKey,
          contentType: bookletFile.type || 'application/pdf',
          onProgress: (p, t) => setProgress({ part: p, total: t, label: 'Enviando encarte...' }),
        });
      }

      setProgress({ part: 0, total: 0, label: 'Registrando no Supabase...' });
      await createItemRow({
        audioPath: isIso ? null : mainKey,
        isoPath: isIso ? mainKey : null,
        bookletPath: bookletKey,
        categoryValue: normalizedCategory,
      });

      toast.success('IMORTALIZADO', { description: 'Upload concluído e item criado no banco.' });
      setMainFile(null);
      setBookletFile(null);
    } catch (e) {
      toast.error('ERRO NO UPLOAD', { description: e.message });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const loadObjects = async () => {
    setLoadingObjects(true);
    try {
      const data = await apiGet(`/api/b2-objects?prefix=${encodeURIComponent(prefix || '')}&max=500`);
      setObjects(data.objects || []);
    } catch (e) {
      toast.error('ERRO AO LISTAR', { description: e.message });
    } finally {
      setLoadingObjects(false);
    }
  };

  useEffect(() => {
    if (tab !== 'link') return;
    if (objects.length > 0) return;
    loadObjects();
  }, [tab]);

  const linkExisting = async () => {
    if (!destinationBase) {
      toast.error('CAMPOS OBRIGATÓRIOS', { description: 'Categoria, artista e nome do item são obrigatórios.' });
      return;
    }

    const isIso = normalizedCategory === 'iso';
    const main = isIso ? selectedIsoKey : selectedAudioKey;
    if (!main) {
      toast.error('SELEÇÃO OBRIGATÓRIA', { description: isIso ? 'Selecione um ISO.' : 'Selecione um áudio.' });
      return;
    }

    setBusy(true);
    try {
      await createItemRow({
        audioPath: isIso ? null : main,
        isoPath: isIso ? main : null,
        bookletPath: selectedBookletKey || null,
        categoryValue: normalizedCategory,
      });
      toast.success('VINCULADO', { description: 'Item criado apontando para o arquivo existente.' });
      setSelectedAudioKey('');
      setSelectedIsoKey('');
      setSelectedBookletKey('');
    } catch (e) {
      toast.error('ERRO AO VINCULAR', { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white py-8 px-4 md:px-6 pt-20">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-300 text-xs font-bold uppercase tracking-widest">
              <Shield className="w-4 h-4" /> Cofre • Imortalidade
            </div>
            <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter mt-4 uppercase">
              Upload <span className="text-fuchsia-400">Operacional</span>
            </h1>
            <p className="text-white/40 text-sm mt-2">Enviar para Backblaze B2 e registrar no Supabase automaticamente</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab('upload')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition ${
              tab === 'upload' ? 'bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-200' : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
            }`}
          >
            <Upload className="w-4 h-4" /> Upload
          </button>
          <button
            type="button"
            onClick={() => setTab('link')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition ${
              tab === 'link' ? 'bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-200' : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
            }`}
          >
            <Link2 className="w-4 h-4" /> Vincular Existente
          </button>
        </div>

        <div className="bg-[#050505] border border-white/10 rounded-2xl p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/50">Categoria</label>
              <select
                value={normalizedCategory}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"
              >
                <option value="" className="bg-[#050505]">Selecione</option>
                <option value="single" className="bg-[#050505]">Single</option>
                <option value="coletanea" className="bg-[#050505]">Coletânea</option>
                <option value="iso" className="bg-[#050505]">ISO</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/50">Artista</label>
              <input
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/50">Nome do Item</label>
              <input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/50">Capa (URL opcional)</label>
              <input
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"
              />
            </div>
          </div>

          {destinationBase ? (
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 text-xs">
              <Sparkles className="w-4 h-4 text-[#D4AF37]" /> Destino: <span className="text-white/80 font-semibold">{destinationBase}</span>
            </div>
          ) : null}
        </div>

        {tab === 'upload' ? (
          <div className="bg-[#050505] border border-white/10 rounded-2xl p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/50">
                  Arquivo Principal ({normalizedCategory === 'iso' ? 'ISO' : 'Áudio'})
                </label>
                <input
                  type="file"
                  onChange={(e) => setMainFile(e.target.files?.[0] || null)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/50">Encarte (opcional)</label>
                <input
                  type="file"
                  onChange={(e) => setBookletFile(e.target.files?.[0] || null)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"
                />
              </div>
            </div>

            {progress ? (
              <div className="bg-black/40 border border-white/10 rounded-2xl p-4">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>{progress.label}</span>
                  {progress.total ? <span>{progress.part}/{progress.total}</span> : <span>...</span>}
                </div>
                {progress.total ? (
                  <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-fuchsia-500 to-purple-500"
                      style={{ width: `${Math.min(100, Math.max(0, (progress.part / progress.total) * 100))}%` }}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              disabled={busy}
              onClick={uploadNew}
              className="inline-flex items-center justify-center gap-2 bg-fuchsia-500/10 text-fuchsia-200 border border-fuchsia-500/40 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-fuchsia-500/80 hover:bg-fuchsia-500/15 transition-all disabled:opacity-50 w-full"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Imortalizar
            </button>
          </div>
        ) : (
          <div className="bg-[#050505] border border-white/10 rounded-2xl p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/50">Prefix</label>
                <input
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"
                />
              </div>
              <button
                type="button"
                disabled={loadingObjects}
                onClick={loadObjects}
                className="inline-flex items-center justify-center gap-2 bg-white/5 text-white/70 border border-white/10 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-white/20 hover:bg-white/10 transition-all disabled:opacity-50"
              >
                {loadingObjects ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Listar
              </button>
            </div>

            <div className="flex items-center gap-3">
              <input
                value={objectsQuery}
                onChange={(e) => setObjectsQuery(e.target.value)}
                placeholder="Filtrar por nome do arquivo..."
                className="flex-1 bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"
              />
              <div className="text-xs text-white/40">{filteredObjects.length}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/50">Áudio</label>
                <select
                  value={selectedAudioKey}
                  onChange={(e) => setSelectedAudioKey(e.target.value)}
                  disabled={normalizedCategory === 'iso'}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white outline-none disabled:opacity-50"
                >
                  <option value="" className="bg-[#050505]">Selecione</option>
                  {filteredObjects.map((o) => (
                    <option key={o.key} value={o.key} className="bg-[#050505]">{o.key}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/50">ISO</label>
                <select
                  value={selectedIsoKey}
                  onChange={(e) => setSelectedIsoKey(e.target.value)}
                  disabled={normalizedCategory !== 'iso'}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white outline-none disabled:opacity-50"
                >
                  <option value="" className="bg-[#050505]">Selecione</option>
                  {filteredObjects.map((o) => (
                    <option key={o.key} value={o.key} className="bg-[#050505]">{o.key}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/50">Encarte</label>
                <select
                  value={selectedBookletKey}
                  onChange={(e) => setSelectedBookletKey(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"
                >
                  <option value="" className="bg-[#050505]">Opcional</option>
                  {filteredObjects.map((o) => (
                    <option key={o.key} value={o.key} className="bg-[#050505]">{o.key}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={linkExisting}
              className="inline-flex items-center justify-center gap-2 bg-fuchsia-500/10 text-fuchsia-200 border border-fuchsia-500/40 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-fuchsia-500/80 hover:bg-fuchsia-500/15 transition-all disabled:opacity-50 w-full"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Vincular ao Banco
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

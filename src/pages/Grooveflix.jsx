import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Film, Sparkles, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import GrooveflixPlayer from '../components/GrooveflixPlayer';
import GrooveflixRow from '../components/GrooveflixRow';
import GrooveflixUploader from '../components/GrooveflixUploader';
import { useI18n } from '../contexts/I18nContext.jsx';
import { useSubscription } from '../contexts/SubscriptionContext.jsx';

function safeParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export default function Grooveflix() {
  const { t } = useI18n();
  const { profile, settings, isTrialing, isActive, refresh } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [continueMap, setContinueMap] = useState({});
  const [meteredMap, setMeteredMap] = useState({});
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showUploader, setShowUploader] = useState(false);

  useEffect(() => {
    const stored = safeParseJson(localStorage.getItem('rg_grooveflix_continue_v1') || '{}') || {};
    setContinueMap(stored);

    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('items')
          .select('id, title, artist, image_url, created_at, metadata')
          .order('created_at', { ascending: false })
          .limit(80);

        if (error) throw error;
        setItems(data || []);
      } catch (e) {
        toast.error('ERRO AO CARREGAR GROOVEFLIX', {
          description: e.message || 'Tente novamente.',
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const refreshItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('items')
        .select('id, title, artist, image_url, created_at, metadata')
        .order('created_at', { ascending: false })
        .limit(80);

      if (error) throw error;
      setItems(data || []);
    } catch (e) {
      toast.error('ERRO AO CARREGAR GROOVEFLIX', {
        description: e.message || 'Tente novamente.',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isTrialing) return;
    if (!activeId) return;
    if (meteredMap[activeId]) return;
    setMeteredMap((prev) => ({ ...prev, [activeId]: true }));
    void refresh();
  }, [activeId, isTrialing, meteredMap, refresh]);

  const canDownload = useMemo(() => {
    const lvl = Number(profile?.user_level || 0);
    if (!isActive) return false;
    return lvl >= 2;
  }, [isActive, profile?.user_level]);

  const shouldUsePreviewAudio = useMemo(() => {
    if (!isTrialing) return false;
    if (settings?.limit_audio_quality_on_trial === false) return false;
    return String(settings?.max_trial_quality || 'preview') === 'preview';
  }, [isTrialing, settings?.limit_audio_quality_on_trial, settings?.max_trial_quality]);

  const tracks = useMemo(() => {
    return (items || [])
      .map((item) => {
        const meta = item?.metadata || {};
        const gf = meta?.grooveflix || {};

        const category = String(gf?.category || '').toLowerCase();
        const audioPath = shouldUsePreviewAudio
          ? (gf?.preview_path || gf?.audio_path || gf?.flac_path || '')
          : (gf?.audio_path || gf?.flac_path || gf?.preview_path || '');

        const isoPath = gf?.iso_path || '';
        const bookletPath = gf?.booklet_path || gf?.encarte_path || '';
        if (!audioPath && !isoPath && !bookletPath) return null;

        return {
          id: item.id,
          title: item.title || 'Untitled',
          artist: item.artist || '',
          coverUrl: item.image_url || '',
          category: category || 'single',
          audioPath: audioPath || null,
          isoPath: isoPath || null,
          bookletPath: bookletPath || null,
        };
      })
      .filter(Boolean);
  }, [items, shouldUsePreviewAudio]);

  const filteredTracks = useMemo(() => {
    const c = String(categoryFilter || 'all').toLowerCase();
    if (c === 'all') return tracks;
    return (tracks || []).filter((t) => String(t.category || '').toLowerCase() === c);
  }, [tracks, categoryFilter]);

  const byId = useMemo(() => {
    const map = {};
    tracks.forEach((trk) => { map[trk.id] = trk; });
    return map;
  }, [tracks]);

  const continueListening = useMemo(() => {
    const entries = Object.entries(continueMap || {})
      .map(([id, progress]) => ({ id, progress: Number(progress || 0) }))
      .filter((x) => x.id && x.progress > 10 && byId[x.id])
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 18);
    return entries.map((e) => byId[e.id]);
  }, [continueMap, byId]);

  const recentlyImmortalized = useMemo(() => tracks.slice(0, 24), [tracks]);

  const japanesePressings = useMemo(() => {
    const hits = tracks.filter((trk) => /japan|japanese|\bjp\b/i.test(`${trk.title} ${trk.artist}`));
    return (hits.length ? hits : tracks).slice(0, 24);
  }, [tracks]);

  const forgottenBrazil = useMemo(() => {
    const hits = tracks.filter((trk) => /brasil|brazil|samba|mpb|bossa/i.test(`${trk.title} ${trk.artist}`));
    return (hits.length ? hits : tracks).slice(0, 24);
  }, [tracks]);

  const queue = useMemo(() => {
    const ids = new Set();
    const result = [];
    [continueListening, recentlyImmortalized, japanesePressings, forgottenBrazil].forEach((arr) => {
      (arr || []).forEach((trk) => {
        if (!trk?.id || ids.has(trk.id)) return;
        ids.add(trk.id);
        result.push(trk);
      });
    });
    return result;
  }, [continueListening, recentlyImmortalized, japanesePressings, forgottenBrazil]);

  useEffect(() => {
    if (activeId) return;
    if (continueListening.length > 0) setActiveId(continueListening[0].id);
    else if (recentlyImmortalized.length > 0) setActiveId(recentlyImmortalized[0].id);
  }, [activeId, continueListening, recentlyImmortalized]);

  const onPick = (track) => {
    if (!track?.id) return;
    setActiveId(track.id);
  };

  const onProgress = (id, seconds) => {
    if (!id) return;
    const next = { ...(continueMap || {}) };
    next[id] = Math.floor(Number(seconds || 0));
    setContinueMap(next);
    localStorage.setItem('rg_grooveflix_continue_v1', JSON.stringify(next));
  };

  return (
    <div className="min-h-screen bg-black text-white pb-28">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-black" />
        <div className="absolute -top-40 -left-40 w-[520px] h-[520px] bg-fuchsia-600/15 blur-[120px]" />
        <div className="absolute top-10 right-[-160px] w-[620px] h-[620px] bg-purple-600/12 blur-[140px]" />
        <div className="absolute bottom-[-220px] left-1/3 w-[640px] h-[640px] bg-fuchsia-600/10 blur-[160px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 md:px-6 pt-28 space-y-10">
        <header className="flex items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-fuchsia-500/30 bg-white/5 text-[10px] font-black uppercase tracking-[0.22em]">
              <Sparkles className="w-4 h-4 text-fuchsia-400" />
              {t('grooveflix.badge') || 'HI-FI STREAMING'}
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter">
              GROOVEFLIX<span className="text-fuchsia-400">.</span>
            </h1>
            <p className="text-white/55 text-sm md:text-base max-w-2xl">
              {t('grooveflix.subtitle') || 'O sarcófago digital do colecionador. Streaming e curadoria em estética Hi‑Fi.'}
            </p>
          </div>

          <div className="hidden md:flex items-center gap-2 text-white/50 text-xs uppercase tracking-widest">
            <Film className="w-4 h-4" />
            {loading ? (t('grooveflix.loading') || 'Carregando...') : `${tracks.length} ${t('grooveflix.albums') || 'álbuns'}`}
          </div>

          {profile && (
            <button
              onClick={() => setShowUploader(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/40 text-fuchsia-200 text-xs font-black uppercase tracking-widest hover:bg-fuchsia-500/30 transition"
            >
              <Plus className="w-4 h-4" />
              Adicionar CD
            </button>
          )}
        </header>

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'single', label: 'Single' },
            { id: 'album', label: 'Álbum' },
            { id: 'coletanea', label: 'Coletânea' },
            { id: 'iso', label: 'ISO' },
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryFilter(c.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition ${
                categoryFilter === c.id
                  ? 'bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-200'
                  : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="space-y-12">
          <GrooveflixRow
            title={t('grooveflix.rows.continue') || 'Continuar Ouvindo'}
            items={continueListening}
            onPick={onPick}
          />
          <GrooveflixRow
            title={t('grooveflix.rows.recent') || 'Recém Imortalizados'}
            items={recentlyImmortalized}
            onPick={onPick}
          />
          <GrooveflixRow
            title={t('grooveflix.rows.jp') || 'Prensagens Japonesas'}
            items={japanesePressings}
            onPick={onPick}
          />
          <GrooveflixRow
            title={t('grooveflix.rows.br') || 'Grooves Brasileiros Esquecidos'}
            items={forgottenBrazil}
            onPick={onPick}
          />
        </div>
      </div>

      <GrooveflixPlayer
        queue={queue}
        activeId={activeId}
        onChangeActiveId={setActiveId}
        onProgress={(id, seconds) => onProgress(id, seconds)}
        canDownload={canDownload}
        trialing={String(profile?.subscription_status || '').toLowerCase() === 'trialing'}
      />

      <GrooveflixUploader
        isOpen={showUploader}
        onClose={() => setShowUploader(false)}
        onSuccess={refreshItems}
      />
    </div>
  );
}


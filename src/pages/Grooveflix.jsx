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
  const [isAdmin, setIsAdmin] = useState(false);
  
  useEffect(() => {
    const checkAdmin = async () => {
      const { data } = await supabase.rpc('check_grooveflix_access');
      setIsAdmin(data?.is_admin === true);
    };
    checkAdmin();
  }, []);

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
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-charcoal-deep via-black to-black" />
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-fuchsia-600/10 blur-[150px]" />
        <div className="absolute top-20 right-[-200px] w-[700px] h-[700px] bg-purple-600/8 blur-[160px]" />
        <div className="absolute bottom-[-300px] left-1/4 w-[800px] h-[800px] bg-fuchsia-600/5 blur-[180px]" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-fuchsia-500/10 to-transparent" />
      </div>

      <div className="relative max-w-[1600px] mx-auto px-4 md:px-6 pt-28 space-y-12">
        <header className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-8">
          <div className="relative">
            <div className="absolute -top-6 -left-4 w-24 h-24 bg-fuchsia-500/10 rounded-full blur-2xl" />
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30">
                <Sparkles className="w-3 h-3 text-fuchsia-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-fuchsia-300">{t('grooveflix.badge') || 'HI-FI STREAMING'}</span>
              </div>
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter">
              GROOVEFLIX<span className="text-fuchsia-400">.</span>
            </h1>
            <div className="flex items-center gap-4 mt-4">
              <div className="h-[2px] w-16 bg-gradient-to-r from-fuchsia-500 to-transparent" />
              <p className="text-white/40 text-sm md:text-base max-w-xl font-medium tracking-wide">
                {t('grooveflix.subtitle') || 'O sarcófago digital do colecionador. Streaming e curadoria em estética Hi‑Fi.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Film className="w-4 h-4 text-white/50" />
              <span className="text-white/60 text-xs font-medium uppercase tracking-widest">
                {loading ? (t('grooveflix.loading') || 'Carregando...') : `${tracks.length} ${t('grooveflix.albums') || 'Álbuns'}`}
              </span>
            </div>

            {isAdmin && (
              <button
                onClick={() => {
                  console.log('[GROOVEFLIX] Admin detected, opening uploader');
                  setShowUploader(true);
                }}
                className="group relative flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-purple-600 border border-fuchsia-400/30 text-white text-[11px] font-black uppercase tracking-widest overflow-hidden transition-all hover:shadow-lg hover:shadow-fuchsia-500/20 animate-pulse"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-fuchsia-400 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <Plus className="w-4 h-4 relative z-10" />
                <span className="relative z-10">ADMIN: Adicionar CD</span>
              </button>
            )}
          </div>
        </header>

        <div className="relative rounded-2xl p-1 bg-gradient-to-r from-fuchsia-500/20 via-purple-500/10 to-transparent">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-fuchsia-500/5 to-transparent" />
          <div className="relative flex flex-wrap gap-2 p-4">
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
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                  categoryFilter === c.id
                    ? 'bg-fuchsia-500/20 border-fuchsia-500/50 text-fuchsia-200 shadow-lg shadow-fuchsia-500/10'
                    : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-14">
          {continueListening.length > 0 && (
            <GrooveflixRow
              title={t('grooveflix.rows.continue') || 'Continuar Ouvindo'}
              items={continueListening}
              onPick={onPick}
            />
          )}
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
        isAdmin={isAdmin}
        userId={profile?.id}
      />
    </div>
  );
}


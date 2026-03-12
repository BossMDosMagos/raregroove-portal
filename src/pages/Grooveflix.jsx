import React, { useEffect, useMemo, useState } from 'react';
import { Film, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import GrooveflixPlayer from '../components/GrooveflixPlayer';
import GrooveflixRow from '../components/GrooveflixRow';
import { buildGrooveflixUrl } from '../utils/grooveflix';
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
  const navigate = useNavigate();
  const { profile, settings, isTrialing, isActive, refresh } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [continueMap, setContinueMap] = useState({});
  const [meteredMap, setMeteredMap] = useState({});

  useEffect(() => {
    const stored = safeParseJson(localStorage.getItem('rg_grooveflix_continue_v1') || '{}') || {};
    setContinueMap(stored);

    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('items')
          .select('id, title, artist, band, image_url, created_at, metadata')
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

  const canDownload = useMemo(() => {
    if (isActive) return true;
    if (isTrialing) return settings?.block_downloads_on_trial === false;
    return false;
  }, [isActive, isTrialing, settings?.block_downloads_on_trial]);

  const shouldUsePreviewAudio = useMemo(() => {
    if (!isTrialing) return false;
    if (settings?.limit_audio_quality_on_trial === false) return false;
    return String(settings?.max_trial_quality || 'preview') === 'preview';
  }, [isTrialing, settings?.limit_audio_quality_on_trial, settings?.max_trial_quality]);

  const tracks = useMemo(() => {
    return (items || []).map((item) => {
      const meta = item?.metadata || {};
      const gf = meta?.grooveflix || {};

      const direct = gf?.audio_url || gf?.stream_url || '';
      const audioPath = shouldUsePreviewAudio
        ? (gf?.preview_path || gf?.audio_path || gf?.flac_path || '')
        : (gf?.audio_path || gf?.flac_path || gf?.preview_path || '');

      const audioUrl = direct ? String(direct) : buildGrooveflixUrl(audioPath);

      const isoUrl = gf?.iso_url ? String(gf.iso_url) : buildGrooveflixUrl(gf?.iso_path || '');
      const bookletUrl = gf?.booklet_url ? String(gf.booklet_url) : buildGrooveflixUrl(gf?.booklet_path || gf?.encarte_path || '');

      return {
        id: item.id,
        title: item.title || 'Untitled',
        artist: item.artist || item.band || '',
        coverUrl: item.image_url || '',
        audioUrl: audioUrl || null,
        isoUrl: isoUrl || null,
        bookletUrl: bookletUrl || null,
      };
    });
  }, [items, shouldUsePreviewAudio]);

  useEffect(() => {
    if (!isTrialing) return;
    if (!activeId) return;
    if (meteredMap[activeId]) return;

    const track = (tracks || []).find((t) => t.id === activeId);
    if (!track?.audioUrl) return;

    setMeteredMap((prev) => ({ ...prev, [activeId]: true }));

    const run = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('grooveflix-meter', {
          body: { url: track.audioUrl }
        });
        if (error) throw error;
        if (String(data?.status || '').toLowerCase() === 'expired') {
          toast.error('TRIAL EXPIRADO', {
            description: 'O limite do trial foi atingido ou o tempo expirou.',
            style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
          });
          await refresh();
          navigate('/plans?restricted=1', { replace: true });
        } else {
          await refresh();
        }
      } catch (e) {
        void e;
      }
    };

    run();
  }, [activeId, isTrialing, meteredMap, navigate, refresh, tracks]);

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
        </header>

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
    </div>
  );
}


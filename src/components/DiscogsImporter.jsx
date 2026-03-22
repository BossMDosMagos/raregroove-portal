import { useState } from 'react';
import { Search, Check, Disc, Loader2, Music, ExternalLink, Tag, Building, Globe, Calendar, Disc3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useI18n } from '../contexts/I18nContext.jsx';
import { useDiscogs } from '../contexts/DiscogsContext.jsx';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://hlfirfukbrisfpebaaur.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsZmlyZnVrYnJpc2ZwZWJhYXVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNzIwNTUsImV4cCI6MjA4Njg0ODA1NX0.vXadY-YLsKGuWXEb2UmHAqoDEx0vD_FpFkrTs55CiuU';

async function searchDiscogs(query, limit = 20) {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token || SUPABASE_ANON_KEY;

  const response = await fetch(`${SUPABASE_URL}/functions/v1/discogs-search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ query, type: 'search', limit }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Erro ${response.status}: ${errorData}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return data.data;
}

async function getReleaseDetails(releaseId) {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token || SUPABASE_ANON_KEY;

  const response = await fetch(`${SUPABASE_URL}/functions/v1/discogs-search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ type: 'release', releaseId }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Erro ${response.status}: ${errorData}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return data.data;
}

export function DiscogsImporter({ onClose }) {
  const { t } = useI18n();
  const { importFromDiscogs } = useDiscogs();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [fullDetails, setFullDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setSelected(null);
    setFullDetails(null);
    setResults([]);

    try {
      const data = await searchDiscogs(searchQuery, 20);
      setResults(data || []);
      if (!data || data.length === 0) {
        toast.info(t('grooveflix.discogs.noResults'));
      }
    } catch (error) {
      toast.error(t('grooveflix.discogs.fetchError'), {
        description: error.message,
      });
      setResults([]);
    }

    setLoading(false);
  };

  const handleSelect = async (release) => {
    setSelected(release);
    setFetchingDetails(true);
    setFullDetails(null);

    try {
      const details = await getReleaseDetails(release.id);
      setFullDetails(details);
    } catch (error) {
      toast.error(t('grooveflix.discogs.fetchError'), {
        description: error.message,
      });
    }

    setFetchingDetails(false);
  };

  const handleImport = () => {
    if (!selected || !fullDetails) return;

    const artistName = fullDetails.artists_sort || fullDetails.artists?.[0]?.name || selected.title.split(' - ')[0] || 'Unknown';
    const albumTitle = fullDetails.title || selected.title;
    
    console.log('[DISCOGS IMPORT] fullDetails.images:', fullDetails.images);
    
    const coverUrl = fullDetails.images?.[0]?.uri || 
                      fullDetails.images?.[0]?.uri150 || 
                      selected.thumb || 
                      fullDetails.thumb ||
                      null;
    
    console.log('[DISCOGS IMPORT] coverUrl:', coverUrl);
    
    const genres = [...(fullDetails.genres || []), ...(fullDetails.styles || [])];
    const labels = fullDetails.labels?.map(l => l.name).filter(Boolean).join(', ');
    const catalogNumber = fullDetails.labels?.[0]?.catno;
    const tracklist = fullDetails.tracklist?.map((t, i) => ({
      position: t.position || String(i + 1),
      title: t.title,
      duration: t.duration,
    })) || [];

    importFromDiscogs({
      title: albumTitle,
      artist: artistName,
      genre: genres.join(', '),
      year: fullDetails.year || selected.year || '',
      coverUrl: coverUrl,
      coverUrlThumbnail: fullDetails.images?.[0]?.uri150 || fullDetails.images?.[0]?.uri || coverUrl,
      discogsId: selected.id,
      discogsMasterId: fullDetails.master_id,
      country: fullDetails.country,
      labels: labels,
      catalogNumber: catalogNumber,
      formats: fullDetails.formats?.map(f => f.name).join(', '),
      tracklist: tracklist,
      description: fullDetails.notes || '',
    });

    toast.success(t('grooveflix.discogs.importSuccess'), {
      description: `${albumTitle} - ${artistName}`,
    });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fuchsia-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('grooveflix.discogs.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:border-fuchsia-500 focus:outline-none transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !searchQuery.trim()}
          className="px-6 py-3 bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('grooveflix.discogs.searching')}
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              {t('grooveflix.discogs.search')}
            </>
          )}
        </button>
      </form>

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-white/40 font-medium uppercase tracking-wider">
            {results.length} {t('grooveflix.discogs.resultsFound')}
          </p>
          
          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {results.map((release) => (
              <button
                key={release.id}
                onClick={() => handleSelect(release)}
                disabled={fetchingDetails}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left ${
                  selected?.id === release.id
                    ? 'bg-fuchsia-500/20 border-fuchsia-500/50'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                } ${fetchingDetails ? 'opacity-50' : ''}`}
              >
                <div className="w-10 h-10 flex-shrink-0 bg-white/5 rounded overflow-hidden">
                  {release.thumb ? (
                    <img src={release.thumb} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Disc className="w-5 h-5 text-white/30" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{release.title}</p>
                  <p className="text-xs text-white/50">
                    {release.year} {release.country && `• ${release.country}`}
                  </p>
                </div>

                {selected?.id === release.id && (
                  <Check className="w-4 h-4 text-fuchsia-400 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div className="border-t border-white/10 pt-4 space-y-4">
          <div className="flex gap-4">
            <div className="w-28 h-28 flex-shrink-0 bg-white/5 rounded-xl overflow-hidden relative group">
              {(fullDetails?.images?.[0]?.uri || selected.thumb) ? (
                <img 
                  src={fullDetails?.images?.[0]?.uri || selected.thumb} 
                  alt="" 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Disc3 className="w-12 h-12 text-white/20" />
                </div>
              )}
              {fetchingDetails && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-fuchsia-400 animate-spin" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white text-lg leading-tight">
                {fullDetails?.title || selected.title}
              </h3>
              <p className="text-white/60 text-sm mt-1">
                {fullDetails?.artists_sort || selected.title.split(' - ')[0]}
              </p>
              
              <div className="flex flex-wrap gap-1.5 mt-2">
                {fullDetails?.year && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/5 rounded text-xs text-white/60">
                    <Calendar className="w-3 h-3" />
                    {fullDetails.year}
                  </span>
                )}
                {fullDetails?.country && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/5 rounded text-xs text-white/60">
                    <Globe className="w-3 h-3" />
                    {fullDetails.country}
                  </span>
                )}
                {fullDetails?.labels?.[0]?.name && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/5 rounded text-xs text-white/60">
                    <Building className="w-3 h-3" />
                    {fullDetails.labels[0].name}
                  </span>
                )}
              </div>
            </div>
          </div>

          {(fullDetails?.genres?.length > 0 || fullDetails?.styles?.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {[...(fullDetails.genres || []), ...(fullDetails.styles || [])].slice(0, 6).map((tag, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-full text-xs text-fuchsia-300">
                  <Tag className="w-3 h-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {fullDetails?.tracklist?.length > 0 && (
            <div className="bg-white/5 rounded-xl p-3 max-h-32 overflow-y-auto">
              <p className="text-xs text-white/40 font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Music className="w-3 h-3" />
                {t('grooveflix.discogs.tracklist')} ({fullDetails.tracklist.length} {t('grooveflix.discogs.tracks')})
              </p>
              <div className="space-y-1">
                {fullDetails.tracklist.slice(0, 10).map((track, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-white/30 w-6">{track.position}</span>
                    <span className="text-white/70 flex-1 truncate">{track.title}</span>
                    {track.duration && <span className="text-white/30">{track.duration}</span>}
                  </div>
                ))}
                {fullDetails.tracklist.length > 10 && (
                  <p className="text-xs text-white/30 text-center pt-1">
                    {t('grooveflix.discogs.moreTracks')} {fullDetails.tracklist.length - 10} {t('grooveflix.discogs.tracks')}
                  </p>
                )}
              </div>
            </div>
          )}

          {fullDetails?.formats?.length > 0 && (
            <p className="text-xs text-white/40">
              {t('grooveflix.discogs.format')}: {fullDetails.formats.map(f => `${f.name}${f.text ? ` (${f.text})` : ''}`).join(', ')}
            </p>
          )}

          <div className="flex gap-2">
            <a
              href={`https://www.discogs.com/release/${selected.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white/60 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t('grooveflix.discogs.viewOnDiscogs')}
            </a>
            
            <button
              onClick={handleImport}
              disabled={!fullDetails || fetchingDetails}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              {t('grooveflix.discogs.import')}
            </button>
          </div>
        </div>
      )}

      {!loading && results.length === 0 && searchQuery && (
        <div className="text-center py-6 text-white/40">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>{t('grooveflix.discogs.noResultsQuery')} "{searchQuery}"</p>
        </div>
      )}

      {!loading && results.length === 0 && !searchQuery && (
        <div className="text-center py-6 text-white/30">
          <Disc className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>{t('grooveflix.discogs.searchTip')}</p>
        </div>
      )}
    </div>
  );
}

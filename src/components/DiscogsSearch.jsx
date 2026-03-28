import { useState } from 'react';
import { Search, Check, Disc, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://hlfirfukbrisfpebaaur.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsZmlyZnVrYnJpc2ZwZWJhYXVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNzIwNTUsImV4cCI6MjA4Njg0ODA1NX0.vXadY-YLsKGuWXEb2UmHAqoDEx0vD_FpFkrTs55CiuU';

async function searchDiscogs(query, limit = 20) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/discogs-search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ query, type: 'search', limit }),
  });

  if (!response.ok) throw new Error(`Erro ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.data;
}

async function getReleaseDetails(releaseId) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/discogs-search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ type: 'release', releaseId }),
  });

  if (!response.ok) throw new Error(`Erro ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.data;
}

export function DiscogsSearch({ onImport }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [fullDetails, setFullDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setSelected(null);
    setFullDetails(null);
    setResults([]);

    try {
      const data = await searchDiscogs(searchQuery, 20);
      setResults(data || []);
      if (!data || data.length === 0) {
        toast.info('Nenhum resultado encontrado');
      }
    } catch (error) {
      toast.error('Erro ao buscar', { description: error.message });
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
      toast.error('Erro ao buscar detalhes', { description: error.message });
    }

    setFetchingDetails(false);
  };

  const handleImport = () => {
    if (!selected || !fullDetails) return;

    const artistName = fullDetails.artists_sort || fullDetails.artists?.[0]?.name || selected.title.split(' - ')[0] || '';
    const albumTitle = fullDetails.title || selected.title;
    const coverUrl = fullDetails.images?.[0]?.uri || fullDetails.images?.[0]?.uri150 || selected.thumb || '';
    const genres = [...(fullDetails.genres || []), ...(fullDetails.styles || [])];
    const description = fullDetails.notes || fullDetails.formats?.[0]?.descriptions?.join(', ') || '';

    onImport({
      title: albumTitle,
      artist: artistName,
      year: fullDetails.year || selected.year || '',
      genre: genres.slice(0, 2).join(', '),
      image_url: coverUrl,
      coverUrlThumbnail: fullDetails.images?.[0]?.uri150 || coverUrl,
      discogsId: selected.id,
      discogsMasterId: fullDetails.master_id,
      description: description,
    });

    toast.success('Dados importados do Discogs!', {
      description: `${albumTitle} - ${artistName}`,
    });

    setSearchQuery('');
    setResults([]);
    setSelected(null);
    setFullDetails(null);
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
            placeholder="Buscar no Discogs..."
            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:border-fuchsia-500 focus:outline-none transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !searchQuery.trim()}
          className="px-5 py-3 bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </button>
      </form>

      {results.length > 0 && !selected && (
        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
          {results.map((release) => (
            <button
              key={release.id}
              type="button"
              onClick={() => handleSelect(release)}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
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
                <p className="text-xs text-white/50">{release.year}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="border-t border-white/10 pt-4 space-y-3">
          <div className="flex gap-4">
            <div className="w-24 h-24 flex-shrink-0 bg-white/5 rounded-xl overflow-hidden relative">
              {(fullDetails?.images?.[0]?.uri || selected.thumb) ? (
                <img 
                  src={fullDetails?.images?.[0]?.uri || selected.thumb} 
                  alt="" 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Disc className="w-10 h-10 text-white/20" />
                </div>
              )}
              {fetchingDetails && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-fuchsia-400 animate-spin" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white text-base leading-tight">
                {fullDetails?.title || selected.title}
              </h3>
              <p className="text-white/60 text-sm mt-1">
                {fullDetails?.artists_sort || selected.title.split(' - ')[0]}
              </p>
              <div className="flex gap-2 mt-2">
                {fullDetails?.year && <span className="text-xs text-white/40">{fullDetails.year}</span>}
                {fullDetails?.country && <span className="text-xs text-white/40">{fullDetails.country}</span>}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <a
              href={`https://www.discogs.com/release/${selected.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white/60 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ver no Discogs
            </a>
            <button
              onClick={handleImport}
              disabled={!fullDetails || fetchingDetails}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              Importar Dados
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

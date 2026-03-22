import { useState } from 'react';
import { Search, Import, Check, ExternalLink, Music, Disc, Loader2 } from 'lucide-react';
import { discogsService } from '../utils/discogsService';
import { toast } from 'sonner';

export function DiscogsImporter({ onSelectData, onClose }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setSelected(null);
    setResults([]);

    console.log('[DISCOGS] Searching for:', searchQuery);

    const { data, error } = await discogsService.searchReleases(searchQuery, { limit: 20 });

    if (error) {
      console.error('[DISCOGS] Search error:', error);
      toast.error('Erro na busca do Discogs', {
        description: error.message || 'Verifique se o token está configurado',
      });
      setResults([]);
    } else {
      console.log('[DISCOGS] Found:', data?.length || 0, 'results');
      setResults(data || []);
      if (!data || data.length === 0) {
        toast.info('Nenhum resultado encontrado', {
          description: 'Tente outro termo de busca',
        });
      }
    }

    setLoading(false);
  };

  const handleSelect = async (release) => {
    setSelected(release);
    
    setFetchingDetails(true);
    const { data: fullRelease, error } = await discogsService.getRelease(release.id);
    setFetchingDetails(false);

    if (error) {
      console.error('[DISCOGS] Error fetching release details:', error);
      toast.error('Erro ao buscar detalhes');
      return;
    }

    const artistName = fullRelease?.artists_sort || fullRelease?.artists?.[0]?.name || release.title.split(' - ')[0] || 'Unknown';
    const albumTitle = fullRelease?.title || release.title;
    const coverUrl = fullRelease?.images?.[0]?.uri || release.thumb || null;
    const genre = fullRelease?.genres?.[0] || release.genres?.[0] || '';
    const year = fullRelease?.year || release.year || '';

    console.log('[DISCOGS] Selected:', { artistName, albumTitle, coverUrl, genre, year });

    if (onSelectData) {
      onSelectData({
        title: albumTitle,
        artist: artistName,
        genre: genre,
        year: year,
        coverUrl: coverUrl,
        discogsId: release.id,
      });
      toast.success('Dados importados do Discogs!', {
        description: `${albumTitle} - ${artistName}`,
      });
    }
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
            placeholder="Ex: Beatles Abbey Road..."
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
              Buscando...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Buscar
            </>
          )}
        </button>
      </form>

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-white/40 font-medium uppercase tracking-wider">
            {results.length} resultados encontrados
          </p>
          
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {results.map((release) => (
              <button
                key={release.id}
                onClick={() => handleSelect(release)}
                disabled={fetchingDetails}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  selected?.id === release.id
                    ? 'bg-fuchsia-500/20 border-fuchsia-500/50'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                } ${fetchingDetails ? 'opacity-50' : ''}`}
              >
                <div className="w-12 h-12 flex-shrink-0 bg-white/5 rounded-lg overflow-hidden">
                  {release.thumb ? (
                    <img src={release.thumb} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Disc className="w-6 h-6 text-white/30" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{release.title}</p>
                  <p className="text-xs text-white/50">
                    {release.year} {release.country && `• ${release.country}`}
                  </p>
                  <p className="text-[10px] text-white/30 truncate">
                    {release.genre?.slice(0, 2).join(', ')}
                  </p>
                </div>

                {selected?.id === release.id && (
                  <Check className="w-5 h-5 text-fuchsia-400 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && results.length === 0 && searchQuery && (
        <div className="text-center py-6 text-white/40">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum resultado para "{searchQuery}"</p>
        </div>
      )}

      {!loading && results.length === 0 && !searchQuery && (
        <div className="text-center py-6 text-white/30">
          <Disc className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Digite um termo de busca para encontrar álbuns</p>
        </div>
      )}
    </div>
  );
}


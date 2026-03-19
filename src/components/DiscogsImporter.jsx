import { useState } from 'react';
import { Search, Import, Check, AlertCircle, ExternalLink, Music, Disc } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { discogsService } from '../utils/discogsService';
import { toast } from 'sonner';

const toastSuccessStyle = { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' };
const toastErrorStyle = { background: '#050505', border: '1px solid #ef4444', color: '#FFF' };

export function DiscogsImporter({ userId, onImportComplete }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setSelected(null);

    const { data, error } = await discogsService.searchReleases(searchQuery, { limit: 20 });

    if (error) {
      toast.error('Erro na busca', { style: toastErrorStyle });
      setResults([]);
    } else {
      setResults(data || []);
    }

    setLoading(false);
  };

  const handleSelect = async (release) => {
    setSelected(release);
  };

  const handleImport = async () => {
    if (!selected) return;

    setImporting(true);

    try {
      const { data: release, error } = await discogsService.getRelease(selected.id);

      if (error) throw error;

      const itemData = {
        seller_id: userId,
        title: release.title,
        artist: release.artists_sort || release.artists?.[0]?.name || 'Unknown',
        discogs_id: release.id,
        discogs_master_id: release.master_id,
        year: release.year,
        genre: release.genres?.[0] || 'Other',
        styles: release.styles || [],
        format: release.formats?.[0]?.name || 'CD',
        description: release.notes || '',
        country: release.country,
        label: release.labels?.[0]?.name,
        catno: release.labels?.[0]?.catno,
        image_url: release.images?.[0]?.uri,
        thumb_url: release.thumb,
        condition: 'VG+',
        sleeve_condition: 'VG+',
        is_sold: false,
        is_reserved: false,
      };

      const { data: item, error: insertError } = await supabase
        .from('items')
        .insert(itemData)
        .select()
        .single();

      if (insertError) throw insertError;

      toast.success('Item importado com sucesso!', { style: toastSuccessStyle });

      if (onImportComplete) {
        onImportComplete(item);
      }

      setSelected(null);
      setSearchQuery('');
      setResults([]);
    } catch (error) {
      toast.error('Erro ao importar', { description: error.message, style: toastErrorStyle });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <Disc className="w-8 h-8 text-amber-500" />
        <div>
          <h2 className="text-xl font-bold text-white">Importar do Discogs</h2>
          <p className="text-sm text-zinc-400">Busque e importe itens diretamente do Discogs</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por título, artista ou ano..."
              className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </form>

      {results.length > 0 && (
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-medium text-zinc-400">
            {results.length} resultados encontrados
          </h3>

          <div className="max-h-96 overflow-y-auto space-y-2">
            {results.map((release) => (
              <button
                key={release.id}
                onClick={() => handleSelect(release)}
                className={`w-full flex items-center gap-4 p-3 rounded-lg border transition-colors text-left ${
                  selected?.id === release.id
                    ? 'bg-amber-500/20 border-amber-500'
                    : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600'
                }`}
              >
                <div className="w-16 h-16 flex-shrink-0 bg-zinc-700 rounded overflow-hidden">
                  {release.thumb ? (
                    <img src={release.thumb} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-8 h-8 text-zinc-500" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{release.title}</p>
                  <p className="text-sm text-zinc-400">
                    {release.year} • {release.country}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {release.format?.join(', ')} • {release.genre?.slice(0, 2).join(', ')}
                  </p>
                </div>

                {selected?.id === release.id && (
                  <Check className="w-5 h-5 text-amber-500 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div className="border-t border-zinc-700 pt-6">
          <h3 className="text-lg font-semibold text-white mb-4">Importar Item</h3>

          <div className="flex gap-4 mb-6">
            <div className="w-32 h-32 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0">
              {selected.thumb ? (
                <img src={selected.thumb} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music className="w-16 h-16 text-zinc-600" />
                </div>
              )}
            </div>

            <div className="flex-1">
              <h4 className="font-bold text-white mb-1">{selected.title}</h4>
              <p className="text-zinc-400 mb-2">{selected.year} • {selected.country}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                {selected.format?.map((f, i) => (
                  <span key={i} className="px-2 py-1 bg-zinc-700 rounded text-zinc-300">
                    {f}
                  </span>
                ))}
                {selected.genre?.slice(0, 3).map((g, i) => (
                  <span key={i} className="px-2 py-1 bg-amber-500/20 rounded text-amber-400">
                    {g}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <a
              href={`https://www.discogs.com/release/${selected.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Ver no Discogs
            </a>

            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-2 px-6 py-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              <Import className="w-4 h-4" />
              {importing ? 'Importando...' : 'Importar Item'}
            </button>
          </div>

          <p className="text-xs text-zinc-500 mt-4">
            Após importar, você poderá editar o preço, condição e adicionar mais detalhes.
          </p>
        </div>
      )}

      {results.length === 0 && !loading && (
        <div className="text-center py-8 text-zinc-500">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Busque por um título, artista ou ano no Discogs</p>
        </div>
      )}
    </div>
  );
}

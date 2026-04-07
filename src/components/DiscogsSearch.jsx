import { useState, useEffect } from 'react';
import { Search, Check, Disc, Loader2, ExternalLink, DollarSign, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { getExchangeRates, formatBRL, convertToBRL } from '../utils/currency';

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

async function getPriceSuggestions(releaseId) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/discogs-search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ type: 'price_suggestions', releaseId }),
  });

  if (!response.ok) throw new Error(`Erro ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.data;
}

export function DiscogsSearch({ onImport, onPriceUpdate }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [fullDetails, setFullDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [priceSuggestions, setPriceSuggestions] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [exchangeRates, setExchangeRates] = useState(null);

  useEffect(() => {
    getExchangeRates().then(setExchangeRates);
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setSelected(null);
    setFullDetails(null);
    setResults([]);
    setHasSearched(true);

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
    if (!release?.id) {
      toast.error('Release inválido');
      return;
    }

    setSelected(release);
    setFetchingDetails(true);
    setFullDetails(null);
    setPriceSuggestions(null);

    try {
      const [details, statsResponse] = await Promise.all([
        getReleaseDetails(release.id),
        fetch(`${SUPABASE_URL}/functions/v1/discogs-search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ 
            type: 'release_stats', 
            releaseId: parseInt(release.id, 10) 
          }),
        }).then(async (r) => {
          if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            throw new Error(err.error || `Erro ${r.status}`);
          }
          return r.json();
        }).catch((e) => {
          console.error('Stats fetch error:', e);
          return { data: null, error: e.message };
        }),
      ]);
      
      const stats = statsResponse?.data || null;
      console.log('[Discogs] Stats response:', JSON.stringify(stats, null, 2));

      setFullDetails(details);
      
      const suggestions = {};
      
      const rawCurrency = stats?.lowest_price?.currency || details?.lowest_price?.currency || 'USD';
      const currency = rawCurrency.toUpperCase();
      const rawLowest = stats?.lowest_price?.value ?? stats?.lowest_price ?? details?.lowest_price ?? null;
      
      console.log('[Discogs] Raw lowest:', rawLowest, 'Currency:', currency);
      
      let lowestValue = null;
      let priceNote = '';
      
      if (rawLowest !== null && rawLowest >= 2) {
        lowestValue = rawLowest;
        priceNote = 'lowest_price';
      } else if (rawLowest !== null && rawLowest > 0 && rawLowest < 2) {
        console.log('[Discogs] Value below $2, applying minimum floor of 3.00 in original currency');
        lowestValue = 3.00;
        priceNote = 'floor_applied';
      }
      
      if (lowestValue !== null) {
        suggestions.lowestPriceUSD = lowestValue;
        suggestions.priceCurrency = currency;
        suggestions.numForSale = stats?.num_for_sale || null;
        suggestions.blockedFromSale = stats?.blocked_from_sale || null;
        suggestions.sellerCredits = stats?.seller_credits || null;
        suggestions.source = stats?.lowest_price ? 'marketplace_stats' : 'release_details';
        suggestions.releaseId = release.id;
        suggestions.priceNote = priceNote;
        suggestions.hasPriceData = true;
        
        console.log('[Discogs] Final lowest value:', lowestValue, 'Currency:', currency);
      } else {
        suggestions.source = 'none';
        suggestions.hasPriceData = false;
        
        const formats = fullDetails?.formats || [];
        const formatDescriptions = formats.flatMap(f => f.descriptions || []);
        const isBoxSet = formatDescriptions.some(d => 
          ['Box Set', 'Boxset', 'Deluxe Edition', 'Limited Edition'].includes(d)
        ) || (fullDetails?.formats?.length && fullDetails.formats.length > 1);
        const isDouble = formatDescriptions.some(d => 
          ['Double', '2xCD', '2xLP', 'Digipack'].includes(d)
        );
        
        suggestions.fallbackPrice = isBoxSet ? 85 : isDouble ? 45 : 25;
        suggestions.fallbackType = isBoxSet ? 'Box Set / Edição de Luxo' : isDouble ? 'CD Duplo / Digipack' : 'CD Simples';
        
        console.log('[Discogs] No valid price found - using fallback:', suggestions.fallbackPrice);
      }
      
      suggestions.albumTitle = fullDetails?.title || selected?.title || '';
      const artistFromSelected = selected?.title?.split(' - ')[0] || '';
      suggestions.artistName = fullDetails?.artists_sort || fullDetails?.artists?.[0]?.name || artistFromSelected || '';
      
      setPriceSuggestions(suggestions);

      if (onPriceUpdate) {
        onPriceUpdate(suggestions);
      }

      if (lowestValue === null && !fullDetails) {
        toast.info('Preço mínimo não disponível para este lançamento');
      }
    } catch (error) {
      toast.error('Erro ao buscar detalhes', { description: error.message });
      console.error('Discogs handleSelect error:', error);
    }

    setFetchingDetails(false);
  };

  const handleImport = () => {
    if (!selected || !fullDetails) return;

    const artistName = fullDetails?.artists_sort || fullDetails?.artists?.[0]?.name || selected.title?.split(' - ')[0] || '';
    const albumTitle = fullDetails?.title || selected.title;
    const coverUrl = fullDetails?.images?.[0]?.uri || fullDetails?.images?.[0]?.uri150 || selected.thumb || '';
    const genres = [...(fullDetails?.genres || []), ...(fullDetails?.styles || [])];
    const description = fullDetails?.notes || fullDetails?.formats?.[0]?.descriptions?.join(', ') || '';

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
      priceSuggestions: priceSuggestions,
    });

    toast.success('Dados importados do Discogs!', {
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
                {fullDetails?.title || selected?.title || 'Carregando...'}
              </h3>
              <p className="text-white/60 text-sm mt-1">
                {fullDetails?.artists_sort || selected?.title?.split(' - ')[0] || 'Carregando...'}
              </p>
              <div className="flex gap-2 mt-2">
                {fullDetails?.year && <span className="text-xs text-white/40">{fullDetails.year}</span>}
                {fullDetails?.country && <span className="text-xs text-white/40">{fullDetails.country}</span>}
              </div>
            </div>
          </div>

          {priceSuggestions && (
            <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-xl p-3 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Dados de Mercado</span>
              </div>
              
              {priceSuggestions?.hasPriceData && priceSuggestions?.lowestPriceUSD ? (
                <>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
                    <div className="text-[10px] text-amber-400/80 uppercase">Piso de Mercado</div>
                    <div className="text-[9px] text-white/40 mb-1">
                      {priceSuggestions.priceNote === 'floor_applied' ? '(Mínimo aplicado)' : '(Geralmente itens VG/G)'}
                    </div>
                    <div className="text-lg font-bold text-emerald-400">
                      {formatBRL(priceSuggestions.lowestPriceUSD * (exchangeRates?.[priceSuggestions.priceCurrency] || exchangeRates?.USD || 5))}
                    </div>
                    <div className="text-sm text-white/40">{priceSuggestions.priceCurrency} {priceSuggestions.lowestPriceUSD.toFixed(2)}</div>
                    {priceSuggestions.numForSale && (
                      <div className="text-[10px] text-white/30 mt-1">{priceSuggestions.numForSale} à venda</div>
                    )}
                  </div>
                  <div className="text-[9px] text-white/30 text-center leading-tight">
                    Dados baseados no menor valor global disponível na Discogs API
                  </div>
                  
                  {(() => {
                    const rawTerm = (priceSuggestions.artistName && priceSuggestions.albumTitle)
                      ? `${priceSuggestions.artistName} ${priceSuggestions.albumTitle}`
                      : (priceSuggestions.albumTitle || '');
                    const cleanTerm = rawTerm.replace(/cd/gi, '').trim().replace(/\s+/g, ' ');
                    const finalQuery = cleanTerm ? `${cleanTerm} cd` : 'cd';
                    return (
                      <>
                        <a
                          href={`https://www.google.com/search?q=${encodeURIComponent(finalQuery + ' preço')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-xs text-blue-400 transition-colors"
                        >
                          <Search className="w-3 h-3" />
                          Pesquisar no Google
                        </a>
                        <a
                          href={`https://lista.mercadolivre.com.br/${encodeURIComponent(finalQuery)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-xs text-yellow-400 transition-colors"
                        >
                          Pesquisar no Mercado Livre
                        </a>
                        <a
                          href={`https://www.discogs.com/sell/history/${priceSuggestions.releaseId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg text-xs text-amber-400 transition-colors"
                        >
                          <TrendingUp className="w-3 h-3" />
                          Ver Histórico Real de Vendas
                        </a>
                      </>
                    );
                  })()}
                </>
              ) : (
                <>
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 text-center">
                    <div className="text-[10px] text-orange-400/80 uppercase">Item raro/sem histórico</div>
                    <div className="text-[9px] text-white/40 mb-2">Não há dados de preço no Discogs</div>
                    <div className="text-sm font-bold text-white">
                      Sugestão base: <span className="text-emerald-400">R$ {priceSuggestions.fallbackPrice},00</span>
                    </div>
                    <div className="text-[9px] text-white/50">({priceSuggestions.fallbackType})</div>
                  </div>
                  
                  {(() => {
                    const rawTerm = (priceSuggestions.artistName && priceSuggestions.albumTitle)
                      ? `${priceSuggestions.artistName} ${priceSuggestions.albumTitle}`
                      : (priceSuggestions.albumTitle || '');
                    const cleanTerm = rawTerm.replace(/cd/gi, '').trim().replace(/\s+/g, ' ');
                    const finalQuery = cleanTerm ? `${cleanTerm} cd` : 'cd';
                    return (
                      <>
                        <a
                          href={`https://www.google.com/search?q=${encodeURIComponent(finalQuery + ' preço')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-xs text-blue-400 transition-colors"
                        >
                          <Search className="w-3 h-3" />
                          Pesquisar no Google
                        </a>
                        <a
                          href={`https://lista.mercadolivre.com.br/${encodeURIComponent(finalQuery)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-xs text-yellow-400 transition-colors"
                        >
                          Pesquisar no Mercado Livre
                        </a>
                      </>
                    );
                  })()}
                  
                  <div className="text-[9px] text-white/40 text-center leading-tight">
                    Defina o preço manualmente considerando a raridade física do item
                  </div>
                </>
              )}
              
              {priceSuggestions?.blockedFromSale && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-center">
                  <span className="text-[10px] text-red-400">Item bloqueado para venda no Discogs</span>
                </div>
              )}
            </div>
          )}

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

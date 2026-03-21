import React, { useState } from 'react';
import { Settings, X, Palette, ExternalLink, Check } from 'lucide-react';
import { LOCAL_SKINS, getSkinById, DEFAULT_SKIN_ID } from '../utils/webampSkins';

export default function SkinSelector({ currentSkinId, onSkinChange, onClose }) {
  const [externalUrl, setExternalUrl] = useState('');
  const [showExternal, setShowExternal] = useState(false);

  const handleSelectSkin = (skin) => {
    localStorage.setItem('grooveflix_skin_id', skin.id);
    localStorage.removeItem('grooveflix_skin_url');
    onSkinChange(skin);
  };

  const handleExternalSkin = () => {
    if (!externalUrl.trim()) return;
    
    const trimmedUrl = externalUrl.trim();
    if (!trimmedUrl.startsWith('http')) {
      alert('URL inválida. A URL deve começar com http:// ou https://');
      return;
    }
    
    localStorage.setItem('grooveflix_skin_url', trimmedUrl);
    localStorage.removeItem('grooveflix_skin_id');
    
    onSkinChange({ id: 'external', name: 'Skin Externa', url: trimmedUrl });
  };

  const handleResetToDefault = () => {
    localStorage.removeItem('grooveflix_skin_id');
    localStorage.removeItem('grooveflix_skin_url');
    const defaultSkin = getSkinById(DEFAULT_SKIN_ID);
    onSkinChange(defaultSkin);
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-gradient-to-br from-charcoal-deep via-charcoal-light to-charcoal-deep border border-fuchsia-500/30 rounded-3xl shadow-2xl shadow-fuchsia-500/20 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-[300px] h-[300px] bg-fuchsia-500/5 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 right-0 w-[200px] h-[200px] bg-purple-500/5 rounded-full blur-[80px]" />
        </div>

        <div className="relative p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center">
                <Palette className="w-5 h-5 text-fuchsia-400" />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase tracking-wider text-white">
                  Skins do Webamp
                </h2>
                <p className="text-white/40 text-xs">Escolha seu visual preferido</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {LOCAL_SKINS.map((skin) => (
              <button
                key={skin.id}
                onClick={() => handleSelectSkin(skin)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                  currentSkinId === skin.id
                    ? 'bg-fuchsia-500/20 border-fuchsia-500/50'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-fuchsia-500/30 to-purple-500/30 border border-white/20 flex items-center justify-center">
                  <Palette className="w-8 h-8 text-white/50" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-bold">{skin.name}</p>
                  <p className="text-white/50 text-sm">{skin.description}</p>
                </div>
                {currentSkinId === skin.id && (
                  <Check className="w-5 h-5 text-fuchsia-400" />
                )}
              </button>
            ))}

            {showExternal ? (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center gap-2 text-white/50 text-sm">
                  <ExternalLink className="w-4 h-4" />
                  <span>Carregar skin externa</span>
                </div>
                <input
                  type="url"
                  placeholder="Cole a URL do arquivo .wsz aqui..."
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-black/50 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-fuchsia-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleExternalSkin}
                    className="flex-1 px-4 py-2 rounded-lg bg-fuchsia-500 text-white font-bold text-sm hover:bg-fuchsia-600 transition"
                  >
                    Carregar
                  </button>
                  <button
                    onClick={() => setShowExternal(false)}
                    className="px-4 py-2 rounded-lg bg-white/10 text-white/70 text-sm hover:bg-white/20 transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowExternal(true)}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-white/5 border border-dashed border-white/20 text-white/50 hover:bg-white/10 hover:text-white/70 transition"
              >
                <ExternalLink className="w-5 h-5" />
                <span>Carregar skin externa (URL .wsz)</span>
              </button>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-white/10">
            <button
              onClick={handleResetToDefault}
              className="w-full px-4 py-2 rounded-lg bg-white/5 text-white/50 text-sm hover:bg-white/10 hover:text-white/70 transition"
            >
              Resetar para padrão
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

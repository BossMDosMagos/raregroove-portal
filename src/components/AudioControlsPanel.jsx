import { useState, useMemo, useEffect, useRef } from 'react';
import dotMatrixFont from '../assets/fonts/5x7-dot-matrix.otf';

const BG_COLORS = ['#0a0a0a', '#0d1a0d', '#0d0d1a', '#1a0d0d', '#0d1a1a', '#1a1a0d'];
const TEXT_COLORS = ['#00ff00', '#00ff41', '#00ffff', '#ff6600', '#ffff00', '#ff00ff', '#00ff88'];

const FONT_FAMILY = '"5x7DotMatrix", monospace';

export function AudioControlsPanel({ 
  currentTrack, 
  loopMode, 
  shuffle, 
  showEq,
  toggleShuffle,
  toggleLoop,
  setShowEq,
  volume,
  handleVolumeChange,
  getVolumeDb,
  preAmp,
  handlePreAmpChange,
  currentTime,
  duration,
  handleSeek,
  formatTime,
  currentQueueIndex,
  queue,
  eqBands,
  eqFrequencies,
  handleEqChange,
  eqPreset,
  setEqPreset,
  showPresetMenu,
  setShowPresetMenu,
  EQ_PRESETS,
  applyPreset
}) {
  const [bgColorIndex, setBgColorIndex] = useState(0);
  const [textColorIndex, setTextColorIndex] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const textRef = useRef(null);

  const bgColor = BG_COLORS[bgColorIndex];
  const textColor = TEXT_COLORS[textColorIndex];

  useEffect(() => {
    if (textRef.current) {
      setTextWidth(textRef.current.offsetWidth);
    }
  }, [currentTrack, textColor]);

  const nowPlayingText = useMemo(() => {
    if (!currentTrack) return 'GROOVEFLIX READY...';
    const parts = [];
    if (currentTrack.title) parts.push(currentTrack.title);
    if (currentTrack.artist) parts.push(currentTrack.artist);
    if (currentTrack.album) parts.push(currentTrack.album);
    return parts.length > 0 ? parts.join('  //  ') : 'GROOVEFLIX READY...';
  }, [currentTrack]);

  const duration_text = textWidth > 0 ? `${textWidth / 35}s` : '15s';

  return (
    <div 
      className="rounded overflow-hidden"
      style={{
        backgroundColor: bgColor,
        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.9), inset 2px 2px 4px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.1)',
        fontFamily: FONT_FAMILY,
      }}
    >
      <style>{`
        @font-face {
          font-family: '5x7DotMatrix';
          src: url(${dotMatrixFont}) format('opentype');
          font-weight: normal;
          font-style: normal;
        }
        
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      <div className="flex items-center gap-1 px-2 py-1 border-b border-white/10">
        <div className="flex flex-col gap-[2px]">
          <button
            onClick={() => setBgColorIndex((i) => (i + 1) % BG_COLORS.length)}
            className="w-4 h-2.5 rounded-[2px] border border-zinc-600/50 transition hover:border-yellow-500"
            style={{ backgroundColor: BG_COLORS[(bgColorIndex + 1) % BG_COLORS.length] }}
            title="Fundo"
          />
          <button
            onClick={() => setTextColorIndex((i) => (i + 1) % TEXT_COLORS.length)}
            className="w-4 h-2.5 rounded-[2px] border border-zinc-600/50 transition hover:border-yellow-500"
            style={{ backgroundColor: TEXT_COLORS[(textColorIndex + 1) % TEXT_COLORS.length] }}
            title="Texto"
          />
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="flex items-center gap-1 px-1">
            <span 
              style={{ 
                color: loopMode !== 'none' ? '#00ff41' : '#1a1a1a',
                textShadow: loopMode !== 'none' ? `0 0 5px #00ff41, 1px 1px 0 rgba(0,0,0,0.2)` : '1px 1px 0 rgba(0,0,0,0.1)',
                fontFamily: FONT_FAMILY,
                fontSize: '10px',
              }}
            >
              RPT
            </span>
            <span 
              style={{ 
                color: showEq ? '#00ffff' : '#1a1a1a',
                textShadow: showEq ? `0 0 5px #00ffff, 1px 1px 0 rgba(0,0,0,0.2)` : '1px 1px 0 rgba(0,0,0,0.1)',
                fontFamily: FONT_FAMILY,
                fontSize: '10px',
              }}
            >
              EQ
            </span>
            <span 
              style={{ 
                color: shuffle ? '#ff6600' : '#1a1a1a',
                textShadow: shuffle ? `0 0 5px #ff6600, 1px 1px 0 rgba(0,0,0,0.2)` : '1px 1px 0 rgba(0,0,0,0.1)',
                fontFamily: FONT_FAMILY,
                fontSize: '10px',
              }}
            >
              SHF
            </span>
            <span style={{ color: '#1a1a1a', fontFamily: FONT_FAMILY, fontSize: '10px' }}>|</span>
            <span 
              style={{ 
                color: '#ff00ff',
                textShadow: '0 0 5px #ff00ff, 1px 1px 0 rgba(0,0,0,0.2)',
                fontFamily: FONT_FAMILY,
                fontSize: '10px',
              }}
            >
              ATMOS
            </span>
            <span 
              style={{ 
                color: '#00ffff',
                textShadow: '0 0 5px #00ffff, 1px 1px 0 rgba(0,0,0,0.2)',
                fontFamily: FONT_FAMILY,
                fontSize: '10px',
              }}
            >
              3D
            </span>
          </div>
          <div className="overflow-hidden h-24">
            <div 
              className="flex whitespace-nowrap"
              style={{
                animation: `marquee ${duration_text} linear infinite`,
              }}
            >
              <span 
                ref={textRef}
                style={{ 
                  color: textColor,
                  textShadow: `0 0 8px ${textColor}, 1px 1px 0 rgba(0,0,0,0.15)`,
                  fontFamily: FONT_FAMILY,
                  fontSize: '12px',
                  letterSpacing: '1px',
                }}
              >
                {nowPlayingText}
              </span>
              <span 
                style={{ 
                  color: textColor,
                  textShadow: `0 0 8px ${textColor}, 1px 1px 0 rgba(0,0,0,0.15)`,
                  fontFamily: FONT_FAMILY,
                  fontSize: '12px',
                  letterSpacing: '1px',
                }}
              >
                {nowPlayingText}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-[2px]">
          <button
            onClick={() => setBgColorIndex((i) => (i - 1 + BG_COLORS.length) % BG_COLORS.length)}
            className="w-4 h-2.5 rounded-[2px] border border-zinc-600/50 transition hover:border-yellow-500"
            style={{ backgroundColor: BG_COLORS[(bgColorIndex - 1 + BG_COLORS.length) % BG_COLORS.length] }}
            title="Fundo -"
          />
          <button
            onClick={() => setTextColorIndex((i) => (i - 1 + TEXT_COLORS.length) % TEXT_COLORS.length)}
            className="w-4 h-2.5 rounded-[2px] border border-zinc-600/50 transition hover:border-yellow-500"
            style={{ backgroundColor: TEXT_COLORS[(textColorIndex - 1 + TEXT_COLORS.length) % TEXT_COLORS.length] }}
            title="Texto -"
          />
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="flex items-center justify-between text-[8px] px-2 py-1 text-white/60" style={{ fontFamily: FONT_FAMILY }}>
          <span>{formatTime(currentTime)}</span>
          <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,0,0.2)', color: '#ffff00' }}>
            {currentQueueIndex + 1}/{queue.length}
          </span>
          <span>{formatTime(duration)}</span>
        </div>
        <div 
          className="h-1 mx-2 rounded-full cursor-pointer mb-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={handleSeek}
        >
          <div 
            className="h-full rounded-full"
            style={{ 
              width: `${duration ? (currentTime / duration) * 100 : 0}%`,
              background: `linear-gradient(90deg, ${textColor}88, ${textColor})`,
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 px-2 py-1 border-t border-white/10">
        <button onClick={toggleShuffle} className="w-6 h-5 rounded text-[8px] font-bold" style={{ 
          backgroundColor: shuffle ? 'rgba(255,102,0,0.4)' : 'transparent', 
          color: shuffle ? '#ff6600' : '#1a1a1a' 
        }}>
          SHF
        </button>
        <button onClick={toggleLoop} className="w-6 h-5 rounded text-[8px] font-bold" style={{ 
          backgroundColor: loopMode !== 'none' ? 'rgba(0,255,65,0.4)' : 'transparent', 
          color: loopMode !== 'none' ? '#00ff41' : '#1a1a1a' 
        }}>
          RPT
        </button>
        <button onClick={() => setShowEq(!showEq)} className="w-6 h-5 rounded text-[8px] font-bold" style={{ 
          backgroundColor: showEq ? 'rgba(0,255,255,0.4)' : 'transparent', 
          color: showEq ? '#00ffff' : '#1a1a1a' 
        }}>
          EQ
        </button>
        
        <div className="flex-1 flex items-center gap-1">
          <span className="text-[7px] text-white/50 w-5">VOL</span>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={volume} 
            onChange={handleVolumeChange} 
            className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: textColor }}
          />
          <span className="text-[7px] w-10 text-right" style={{ color: textColor }}>{getVolumeDb()}dB</span>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[7px] text-white/50 w-5">PRE</span>
          <input 
            type="range" 
            min="-12" 
            max="12" 
            step="0.5" 
            value={preAmp} 
            onChange={handlePreAmpChange} 
            className="w-12 h-1 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: textColor }}
          />
          <span className="text-[7px] w-8 text-right" style={{ color: textColor }}>{preAmp > 0 ? '+' : ''}{preAmp.toFixed(1)}</span>
        </div>
      </div>

      {showEq && (
        <div className="border-t border-white/10 px-2 py-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[8px] font-bold" style={{ color: textColor }}>EQUALIZER</span>
            <button
              onClick={() => setShowPresetMenu(!showPresetMenu)}
              className="px-2 py-0.5 text-[7px] rounded transition"
              style={{ backgroundColor: 'rgba(255,255,0,0.2)', color: '#ffff00' }}
            >
              {eqPreset}
            </button>
          </div>
          
          <div className="flex items-end justify-between gap-1 h-14 px-1">
            {eqFrequencies.map((freq) => (
              <div key={freq} className="flex flex-col items-center flex-1">
                <div className="relative w-3 h-full flex flex-col justify-end">
                  <div 
                    className="w-full rounded-sm transition-all"
                    style={{ 
                      height: `${Math.abs(eqBands[freq]) * 3}px`,
                      minHeight: '2px',
                      background: `linear-gradient(to top, ${textColor}88, ${textColor})`,
                    }}
                  />
                  <div className="absolute left-0 right-0 top-1/2 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
                </div>
                <span className="text-[5px] text-white/40 mt-0.5">{freq >= 1000 ? `${freq/1000}k` : freq}</span>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={eqBands[freq]}
                  onChange={(e) => handleEqChange(freq, parseInt(e.target.value))}
                  className="w-full h-1 bg-black/50 rounded-full appearance-none cursor-pointer mt-0.5"
                  style={{ writingMode: 'vertical-lr', direction: 'rtl', accentColor: textColor }}
                />
              </div>
            ))}
          </div>

          {showPresetMenu && (
            <div className="mt-1 p-1 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="grid grid-cols-4 gap-1">
                {Object.keys(EQ_PRESETS).map((presetName) => (
                  <button
                    key={presetName}
                    onClick={() => {
                      applyPreset(presetName);
                      setShowPresetMenu(false);
                    }}
                    className="px-1 py-0.5 text-[7px] rounded transition"
                    style={{
                      backgroundColor: eqPreset === presetName ? 'rgba(255,255,0,0.3)' : 'transparent',
                      color: eqPreset === presetName ? '#ffff00' : '#666',
                    }}
                  >
                    {presetName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

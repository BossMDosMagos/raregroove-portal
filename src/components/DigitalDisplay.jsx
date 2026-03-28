import { useState, useMemo } from 'react';

const BG_COLORS = ['#0a0a0a', '#0d1a0d', '#0d0d1a', '#1a0d0d', '#0d1a1a', '#1a1a0d'];
const TEXT_COLORS = ['#00ff00', '#00ffff', '#ff6600', '#ffff00', '#ff00ff', '#00ff88'];

export function DigitalDisplay({ currentTrack, loopMode, shuffle, showEq }) {
  const [bgColorIndex, setBgColorIndex] = useState(0);
  const [textColorIndex, setTextColorIndex] = useState(0);

  const bgColor = BG_COLORS[bgColorIndex];
  const textColor = TEXT_COLORS[textColorIndex];

  const nowPlayingText = useMemo(() => {
    if (!currentTrack) return 'GROOVEFLIX READY...';
    const parts = [];
    if (currentTrack.title) parts.push(currentTrack.title);
    if (currentTrack.artist) parts.push(currentTrack.artist);
    if (currentTrack.album) parts.push(currentTrack.album);
    return parts.length > 0 ? parts.join('  //  ') + '  //  ' + parts[0] + '  //  ' : 'GROOVEFLIX READY...';
  }, [currentTrack]);

  const duration = useMemo(() => {
    if (!nowPlayingText) return '0s';
    const charsPerSecond = 20;
    return `${Math.ceil(nowPlayingText.length / charsPerSecond)}s`;
  }, [nowPlayingText]);

  return (
    <div className="flex items-center gap-1">
      <div className="flex flex-col gap-0.5">
        <button
          onClick={() => setBgColorIndex((i) => (i + 1) % BG_COLORS.length)}
          className="w-4 h-3 rounded-sm border border-zinc-600 transition hover:border-amber-500"
          style={{ backgroundColor: BG_COLORS[(bgColorIndex + 1) % BG_COLORS.length] }}
          title="Fundo"
        />
        <button
          onClick={() => setTextColorIndex((i) => (i + 1) % TEXT_COLORS.length)}
          className="w-4 h-3 rounded-sm border border-zinc-600 transition hover:border-amber-500"
          style={{ backgroundColor: TEXT_COLORS[(textColorIndex + 1) % TEXT_COLORS.length] }}
          title="Texto"
        />
      </div>

      <div 
        className="relative flex-1 h-10 rounded overflow-hidden border border-zinc-700"
        style={{
          backgroundColor: bgColor,
          boxShadow: `inset 0 0 15px rgba(0,0,0,1), 0 0 1px rgba(255,255,255,0.1)`,
        }}
      >
        <div 
          className="absolute inset-0 flex items-center"
          style={{
            background: `linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)`,
          }}
        />

        <div className="relative w-full h-full flex items-center">
          <div className="flex items-center gap-2 px-2 whitespace-nowrap">
            <span 
              className="text-[9px] font-bold tracking-wider"
              style={{ 
                color: loopMode !== 'none' ? '#00ff00' : '#1a1a1a',
                textShadow: loopMode !== 'none' ? '0 0 6px #00ff00' : 'none',
                fontFamily: 'Courier New, monospace',
              }}
            >
              RPT
            </span>
            <span 
              className="text-[9px] font-bold tracking-wider"
              style={{ 
                color: showEq ? '#00ffff' : '#1a1a1a',
                textShadow: showEq ? '0 0 6px #00ffff' : 'none',
                fontFamily: 'Courier New, monospace',
              }}
            >
              EQ
            </span>
            <span 
              className="text-[9px] font-bold tracking-wider"
              style={{ 
                color: shuffle ? '#ff6600' : '#1a1a1a',
                textShadow: shuffle ? '0 0 6px #ff6600' : 'none',
                fontFamily: 'Courier New, monospace',
              }}
            >
              SHF
            </span>
          </div>

          <div className="flex-1 overflow-hidden relative">
            <div 
              className="inline-flex"
              style={{
                animation: `scrollText ${duration} linear infinite`,
                fontFamily: 'Courier New, monospace',
              }}
            >
              <span 
                className="text-[11px] font-bold tracking-wider px-2"
                style={{ 
                  color: textColor,
                  textShadow: `0 0 8px ${textColor}`,
                }}
              >
                {nowPlayingText}
              </span>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes scrollText {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
      </div>

      <div className="flex flex-col gap-0.5">
        <button
          onClick={() => setBgColorIndex((i) => (i - 1 + BG_COLORS.length) % BG_COLORS.length)}
          className="w-4 h-3 rounded-sm border border-zinc-600 transition hover:border-amber-500"
          style={{ backgroundColor: BG_COLORS[(bgColorIndex - 1 + BG_COLORS.length) % BG_COLORS.length] }}
          title="Fundo -"
        />
        <button
          onClick={() => setTextColorIndex((i) => (i - 1 + TEXT_COLORS.length) % TEXT_COLORS.length)}
          className="w-4 h-3 rounded-sm border border-zinc-600 transition hover:border-amber-500"
          style={{ backgroundColor: TEXT_COLORS[(textColorIndex - 1 + TEXT_COLORS.length) % TEXT_COLORS.length] }}
          title="Texto -"
        />
      </div>
    </div>
  );
}

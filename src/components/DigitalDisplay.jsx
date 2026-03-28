import { useState, useMemo, useEffect, useRef } from 'react';

const BG_COLORS = ['#0a0a0a', '#0d1a0d', '#0d0d1a', '#1a0d0d', '#0d1a1a', '#1a1a0d'];
const TEXT_COLORS = ['#00ff00', '#00ff41', '#00ffff', '#ff6600', '#ffff00', '#ff00ff', '#00ff88'];

export function DigitalDisplay({ currentTrack, loopMode, shuffle, showEq }) {
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

  const duration = textWidth > 0 ? `${textWidth / 35}s` : '15s';

  return (
    <div className="flex items-center gap-1">
      <div className="flex flex-col gap-[2px]">
        <button
          onClick={() => setBgColorIndex((i) => (i + 1) % BG_COLORS.length)}
          className="w-4 h-3 rounded-[2px] border border-zinc-600/50 transition hover:border-amber-500"
          style={{ backgroundColor: BG_COLORS[(bgColorIndex + 1) % BG_COLORS.length] }}
          title="Fundo"
        />
        <button
          onClick={() => setTextColorIndex((i) => (i + 1) % TEXT_COLORS.length)}
          className="w-4 h-3 rounded-[2px] border border-zinc-600/50 transition hover:border-amber-500"
          style={{ backgroundColor: TEXT_COLORS[(textColorIndex + 1) % TEXT_COLORS.length] }}
          title="Texto"
        />
      </div>

      <div 
        className="relative flex-1 h-9 rounded-[3px] overflow-hidden border border-zinc-600/30"
        style={{
          backgroundColor: bgColor,
          boxShadow: `
            inset 0 0 20px rgba(0,0,0,0.9),
            inset 2px 2px 4px rgba(0,0,0,0.5),
            0 0 1px rgba(255,255,255,0.05)
          `,
        }}
      >
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 30%),
              linear-gradient(0deg, rgba(0,0,0,0.1) 0%, transparent 30%),
              repeating-linear-gradient(
                0deg,
                transparent,
                transparent 2px,
                rgba(0,0,0,0.03) 2px,
                rgba(0,0,0,0.03) 3px
              ),
              repeating-linear-gradient(
                90deg,
                transparent,
                transparent 2px,
                rgba(0,0,0,0.03) 2px,
                rgba(0,0,0,0.03) 3px
              )
            `,
          }}
        />

        <div className="relative w-full h-full flex items-center overflow-hidden">
          <div 
            className="flex items-center gap-2 px-2 shrink-0 z-10 border-r border-zinc-700/30"
            style={{ backgroundColor: bgColor }}
          >
            <span 
              className="font-bold tracking-[1px]"
              style={{ 
                color: loopMode !== 'none' ? '#00ff41' : '#1a1a1a',
                textShadow: loopMode !== 'none' ? `0 0 5px #00ff41, 1px 1px 0 rgba(0,0,0,0.2)` : '1px 1px 0 rgba(0,0,0,0.1)',
                fontFamily: '"VT323", "Silkscreen", "Courier New", monospace',
                fontSize: '11px',
              }}
            >
              RPT
            </span>
            <span 
              className="font-bold tracking-[1px]"
              style={{ 
                color: showEq ? '#00ffff' : '#1a1a1a',
                textShadow: showEq ? `0 0 5px #00ffff, 1px 1px 0 rgba(0,0,0,0.2)` : '1px 1px 0 rgba(0,0,0,0.1)',
                fontFamily: '"VT323", "Silkscreen", "Courier New", monospace',
                fontSize: '11px',
              }}
            >
              EQ
            </span>
            <span 
              className="font-bold tracking-[1px]"
              style={{ 
                color: shuffle ? '#ff6600' : '#1a1a1a',
                textShadow: shuffle ? `0 0 5px #ff6600, 1px 1px 0 rgba(0,0,0,0.2)` : '1px 1px 0 rgba(0,0,0,0.1)',
                fontFamily: '"VT323", "Silkscreen", "Courier New", monospace',
                fontSize: '11px',
              }}
            >
              SHF
            </span>
          </div>

          <div className="flex-1 overflow-hidden relative">
            <div 
              className="flex whitespace-nowrap"
              style={{
                animation: `marquee ${duration} linear infinite`,
              }}
            >
              <span 
                ref={textRef}
                className="font-bold tracking-[2px] px-2"
                style={{ 
                  color: textColor,
                  textShadow: `0 0 8px ${textColor}, 1px 1px 0 rgba(0,0,0,0.15)`,
                  fontFamily: '"VT323", "Silkscreen", "Courier New", monospace',
                  fontSize: '16px',
                  letterSpacing: '1px',
                }}
              >
                {nowPlayingText}
              </span>
              <span 
                className="font-bold tracking-[2px] px-2"
                style={{ 
                  color: textColor,
                  textShadow: `0 0 8px ${textColor}, 1px 1px 0 rgba(0,0,0,0.15)`,
                  fontFamily: '"VT323", "Silkscreen", "Courier New", monospace',
                  fontSize: '16px',
                  letterSpacing: '1px',
                }}
              >
                {nowPlayingText}
              </span>
            </div>
          </div>
        </div>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=VT323&family=Silkscreen:wght@400;700&display=swap');
          
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
      </div>

      <div className="flex flex-col gap-[2px]">
        <button
          onClick={() => setBgColorIndex((i) => (i - 1 + BG_COLORS.length) % BG_COLORS.length)}
          className="w-4 h-3 rounded-[2px] border border-zinc-600/50 transition hover:border-amber-500"
          style={{ backgroundColor: BG_COLORS[(bgColorIndex - 1 + BG_COLORS.length) % BG_COLORS.length] }}
          title="Fundo -"
        />
        <button
          onClick={() => setTextColorIndex((i) => (i - 1 + TEXT_COLORS.length) % TEXT_COLORS.length)}
          className="w-4 h-3 rounded-[2px] border border-zinc-600/50 transition hover:border-amber-500"
          style={{ backgroundColor: TEXT_COLORS[(textColorIndex - 1 + TEXT_COLORS.length) % TEXT_COLORS.length] }}
          title="Texto -"
        />
      </div>
    </div>
  );
}

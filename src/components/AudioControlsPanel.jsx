import { useState, useMemo, useEffect, useRef } from 'react';
import dotMatrixFont from '../assets/fonts/5x7-dot-matrix.otf';

const FONT_FAMILY = '"5x7DotMatrix", monospace';
const LCD_BG = '#8ca3a3';
const LCD_FG = '#1a1a1a';
const LCD_LIGHT = '#a8b8b8';

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
  const [volumeBlocks, setVolumeBlocks] = useState(0);
  const textRef = useRef(null);

  const lcdBgColor = LCD_BG;
  const lcdFgColor = LCD_FG;

  const nowPlayingText = useMemo(() => {
    if (!currentTrack) return 'GROOVEFLIX HI-FI...';
    const parts = [];
    if (currentTrack.title) parts.push(currentTrack.title);
    if (currentTrack.artist) parts.push(currentTrack.artist);
    if (currentTrack.album) parts.push(currentTrack.album);
    return parts.length > 0 ? parts.join('  *  ') + '  *  ' + parts[0] + '  *  ' : 'GROOVEFLIX HI-FI...';
  }, [currentTrack]);

  const duration_text = textWidth > 0 ? `${textWidth / 25}s` : '20s';

  useEffect(() => {
    if (textRef.current) {
      setTextWidth(textRef.current.offsetWidth);
    }
    setVolumeBlocks(Math.round(volume * 10));
  }, [currentTrack, textColorIndex, volume]);

  const renderVolumeBar = () => {
    const blocks = [];
    for (let i = 0; i < 10; i++) {
      blocks.push(
        <div 
          key={i}
          className="w-2 h-2 border"
          style={{ 
            backgroundColor: i < volumeBlocks ? lcdFgColor : 'transparent',
            borderColor: lcdFgColor,
          }}
        />
      );
    }
    return blocks;
  };

  const renderEqBars = () => {
    return eqFrequencies.map((freq) => {
      const height = Math.abs(eqBands[freq]);
      const filledBlocks = Math.round((height / 12) * 10);
      const bars = [];
      for (let i = 0; i < 10; i++) {
        bars.push(
          <div 
            key={i}
            className="w-2 border"
            style={{ 
              height: '6px',
              backgroundColor: i < filledBlocks ? lcdFgColor : 'transparent',
              borderColor: lcdFgColor,
            }}
          />
        );
      }
      return (
        <div key={freq} className="flex flex-col items-center">
          <div className="flex flex-col-reverse gap-px">
            {bars}
          </div>
          <span 
            className="text-[5px] mt-0.5" 
            style={{ color: lcdFgColor, fontFamily: FONT_FAMILY }}
          >
            {freq >= 1000 ? `${freq/1000}k` : freq}
          </span>
        </div>
      );
    });
  };

  return (
    <div 
      className="overflow-hidden"
      style={{
        backgroundColor: lcdBgColor,
        imageRendering: 'pixelated',
        boxShadow: `inset 0 0 20px rgba(0,0,0,0.4), inset -2px -2px 4px rgba(0,0,0,0.2), inset 1px 1px 2px rgba(255,255,255,0.1)`,
        border: `2px solid ${LCD_LIGHT}`,
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

      <div className="relative px-3 py-2">
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              repeating-linear-gradient(
                0deg,
                transparent,
                transparent 1px,
                rgba(0,0,0,0.02) 1px,
                rgba(0,0,0,0.02) 2px
              ),
              repeating-linear-gradient(
                90deg,
                transparent,
                transparent 1px,
                rgba(0,0,0,0.02) 1px,
                rgba(0,0,0,0.02) 2px
              )
            `,
          }}
        />

        <div className="relative flex items-center gap-2 border-b-2 pb-2 mb-2" style={{ borderColor: lcdFgColor }}>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setBgColorIndex((i) => (i + 1) % 2)}
              className="w-3 h-3 border"
              style={{ backgroundColor: bgColorIndex === 0 ? lcdBgColor : '#4a5a5a', borderColor: lcdFgColor }}
            />
            <button
              onClick={() => setTextColorIndex((i) => (i + 1) % 3)}
              className="w-3 h-3 border"
              style={{ 
                backgroundColor: textColorIndex === 0 ? lcdFgColor : textColorIndex === 1 ? '#006600' : '#000066', 
                borderColor: lcdFgColor 
              }}
            />
          </div>

          <div className="flex-1">
            <div className="flex gap-1 text-[8px] mb-1" style={{ color: lcdFgColor, fontFamily: FONT_FAMILY }}>
              <span style={{ opacity: loopMode !== 'none' ? 1 : 0.3 }}>[RPT]</span>
              <span style={{ opacity: showEq ? 1 : 0.3 }}>[EQ]</span>
              <span style={{ opacity: shuffle ? 1 : 0.3 }}>[SHF]</span>
              <span>[ATMOS]</span>
              <span>[3D]</span>
            </div>
            <div className="overflow-hidden h-8 relative">
              <div 
                className="flex whitespace-nowrap absolute"
                style={{
                  animation: `marquee ${duration_text} linear infinite`,
                }}
              >
                <span 
                  ref={textRef}
                  className="text-[10px] font-bold"
                  style={{ color: lcdFgColor, fontFamily: FONT_FAMILY, letterSpacing: '1px' }}
                >
                  {nowPlayingText}
                </span>
                <span 
                  className="text-[10px] font-bold"
                  style={{ color: lcdFgColor, fontFamily: FONT_FAMILY, letterSpacing: '1px' }}
                >
                  {nowPlayingText}
                </span>
              </div>
            </div>
          </div>

          <div className="text-[7px] text-right" style={{ color: lcdFgColor, fontFamily: FONT_FAMILY }}>
            <div>[{currentQueueIndex + 1}/{queue.length}]</div>
            <div className="flex gap-1 justify-end">
              <span style={{ opacity: 0.5 }}>{formatTime(currentTime)}</span>
              <span>-</span>
              <span style={{ opacity: 0.5 }}>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <div className="flex gap-1">
            <button onClick={toggleShuffle} className="px-1 py-0.5 border text-[7px]" style={{ color: lcdFgColor, borderColor: lcdFgColor, fontFamily: FONT_FAMILY, backgroundColor: shuffle ? lcdFgColor : 'transparent' }}>
              SHF
            </button>
            <button onClick={toggleLoop} className="px-1 py-0.5 border text-[7px]" style={{ color: lcdFgColor, borderColor: lcdFgColor, fontFamily: FONT_FAMILY, backgroundColor: loopMode !== 'none' ? lcdFgColor : 'transparent' }}>
              RPT
            </button>
            <button onClick={() => setShowEq(!showEq)} className="px-1 py-0.5 border text-[7px]" style={{ color: lcdFgColor, borderColor: lcdFgColor, fontFamily: FONT_FAMILY, backgroundColor: showEq ? lcdFgColor : 'transparent' }}>
              EQ
            </button>
          </div>

          <div className="flex-1 flex items-center gap-2">
            <span className="text-[7px]" style={{ color: lcdFgColor, fontFamily: FONT_FAMILY }}>VOL:</span>
            <div className="flex gap-px">
              {renderVolumeBar()}
            </div>
            <span className="text-[7px]" style={{ color: lcdFgColor, fontFamily: FONT_FAMILY }}>{getVolumeDb()}</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[7px]" style={{ color: lcdFgColor, fontFamily: FONT_FAMILY }}>PRE:</span>
            <input 
              type="range" 
              min="-12" 
              max="12" 
              step="0.5" 
              value={preAmp} 
              onChange={handlePreAmpChange} 
              className="w-16 h-2 appearance-none cursor-pointer"
              style={{ accentColor: lcdFgColor }}
            />
            <span className="text-[7px] w-8" style={{ color: lcdFgColor, fontFamily: FONT_FAMILY }}>{preAmp > 0 ? '+' : ''}{preAmp.toFixed(1)}</span>
          </div>
        </div>

        <div 
          className="h-1 cursor-pointer mb-2 border"
          style={{ backgroundColor: 'transparent', borderColor: lcdFgColor }}
          onClick={handleSeek}
        >
          <div 
            className="h-full transition-all"
            style={{ 
              width: `${duration ? (currentTime / duration) * 100 : 0}%`,
              backgroundColor: lcdFgColor 
            }}
          />
        </div>

        {showEq && (
          <div className="border-t-2 pt-2" style={{ borderColor: lcdFgColor }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[8px] font-bold" style={{ color: lcdFgColor, fontFamily: FONT_FAMILY }}>EQUALIZER</span>
              <button
                onClick={() => setShowPresetMenu(!showPresetMenu)}
                className="px-2 py-0.5 border text-[7px]"
                style={{ color: lcdFgColor, borderColor: lcdFgColor, fontFamily: FONT_FAMILY, backgroundColor: showPresetMenu ? lcdFgColor : 'transparent' }}
              >
                {eqPreset}
              </button>
            </div>

            <div className="flex items-end justify-between gap-1 px-2">
              {renderEqBars()}
            </div>

            <div className="flex gap-1 mt-2 justify-center">
              {Object.keys(EQ_PRESETS).map((presetName) => (
                <button
                  key={presetName}
                  onClick={() => {
                    applyPreset(presetName);
                    setShowPresetMenu(false);
                  }}
                  className="px-1 py-0.5 border text-[6px]"
                  style={{ 
                    color: lcdFgColor, 
                    borderColor: lcdFgColor, 
                    fontFamily: FONT_FAMILY,
                    backgroundColor: eqPreset === presetName ? lcdFgColor : 'transparent'
                  }}
                >
                  {presetName}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-center gap-4 mt-2 pt-2 border-t" style={{ borderColor: lcdFgColor }}>
          <span className="text-[6px]" style={{ color: lcdFgColor, fontFamily: FONT_FAMILY, opacity: 0.5 }}>
            GROOVEFLIX Hi-Fi AUDIO SYSTEM
          </span>
        </div>
      </div>
    </div>
  );
}

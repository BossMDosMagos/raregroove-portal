import { useRef, useEffect, useState } from 'react';

export default function MixerPanel({ vuMeterData, isPlaying, onVolumeChange, volume }) {
  const [channels, setChannels] = useState({
    ch1: { on: true, pat: 50, pan: 50, bal: 50, fader: 75, gain: 50 },
    ch2: { on: true, pat: 50, pan: 50, bal: 50, fader: 75, gain: 50 },
    ch3: { on: true, pat: 50, pan: 50, bal: 50, fader: 75, gain: 50 },
    ch4: { on: true, pat: 50, pan: 50, bal: 50, fader: 75, gain: 50 },
  });
  const [master, setMaster] = useState({ low: 50, mid: 50, hi: 50, pres: 50, gainL: 50, gainR: 50 });
  const [fxSend, setFxSend] = useState({ a: 0, b: 0 });
  const [aux, setAux] = useState({ a: 0, b: 0 });
  const [isRec, setIsRec] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isPlaying) {
        setIsRec(prev => !prev);
      } else {
        setIsRec(false);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const updateChannel = (ch, key, value) => {
    setChannels(prev => ({
      ...prev,
      [ch]: { ...prev[ch], [key]: value }
    }));
  };

  const vuLevelL = vuMeterData?.leftRMS || 0;
  const vuLevelR = vuMeterData?.rightRMS || 0;

  const getVuLedColor = (level) => {
    if (level > 0.9) return 'bg-red-500';
    if (level > 0.7) return 'bg-yellow-400';
    return 'bg-green-500';
  };

  const Knob = ({ value, onChange, size = 'sm' }) => {
    const sizeClasses = size === 'lg' ? 'w-10 h-10' : 'w-6 h-6';
    const rotation = (value / 100) * 270 - 135;
    
    return (
      <div 
        className={`${sizeClasses} rounded-full bg-gradient-to-b from-gray-200 to-gray-400 cursor-pointer relative shadow-lg border border-gray-600`}
        style={{ transform: `rotate(${rotation}deg)` }}
        onMouseDown={(e) => {
          const startY = e.clientY;
          const startVal = value;
          const handleMouseMove = (moveEvent) => {
            const delta = (startY - moveEvent.clientY) / 2;
            const newVal = Math.max(0, Math.min(100, startVal + delta));
            onChange(newVal);
          };
          const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          };
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        }}
      >
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 bg-black rounded-full" style={{ height: '30%' }} />
      </div>
    );
  };

  const Channel = ({ id, channel, label, stereo = false }) => (
    <div className="flex flex-col items-center gap-1 p-1 bg-gradient-to-b from-gray-800 to-gray-900 rounded border border-gray-700">
      <div className="flex items-center gap-1">
        <span className="text-[7px] text-yellow-400 font-bold">{label}</span>
        {stereo && <span className="text-[5px] text-gray-400">ST</span>}
      </div>
      
      <button
        onClick={() => updateChannel(id, 'on', !channel.on)}
        className={`w-4 h-4 rounded text-[5px] font-bold ${channel.on ? 'bg-green-500 text-black' : 'bg-gray-600 text-gray-400'}`}
      >
        ON
      </button>

      <div className="flex flex-col gap-0.5 items-center">
        <Knob value={channel.pat} onChange={(v) => updateChannel(id, 'pat', v)} />
        <span className="text-[5px] text-gray-400">PAT</span>
      </div>

      <div className="flex flex-col gap-0.5 items-center">
        <Knob value={channel.pan} onChange={(v) => updateChannel(id, 'pan', v)} />
        <span className="text-[5px] text-gray-400">PAN</span>
      </div>

      <div className="flex flex-col gap-0.5 items-center">
        <Knob value={channel.bal} onChange={(v) => updateChannel(id, 'bal', v)} />
        <span className="text-[5px] text-gray-400">BAL</span>
      </div>

      <div className="relative h-16 w-3 bg-gray-800 rounded-full border border-gray-600 mt-1">
        <div 
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-300 to-white rounded-full transition-all"
          style={{ height: `${channel.fader}%` }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-2 bg-gradient-to-b from-gray-300 to-gray-500 rounded-sm border border-gray-600" 
             style={{ bottom: `${channel.fader}%`, transform: 'translateX(-50%) translateY(50%)' }} />
      </div>

      <div className="flex items-center gap-0.5 mt-1">
        <div className={`w-1.5 h-1.5 rounded-full ${channel.on ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-gray-600'}`} />
        <div className={`w-1.5 h-1.5 rounded-full ${vuLevelL > 0.3 && channel.on ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-gray-600'}`} />
      </div>
    </div>
  );

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg border-2 border-gray-700 shadow-2xl shadow-black/50 p-2">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap');
        .mixer-font { font-family: 'Orbitron', sans-serif; }
      `}</style>
      
      {/* Header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[8px] text-yellow-400 mixer-font tracking-wider">MIXER PRO</span>
        <div className={`w-2 h-2 rounded-full ${isRec ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/50' : 'bg-gray-600'}`} />
      </div>

      <div className="flex gap-2">
        {/* Channels 1-4 */}
        <div className="flex gap-1">
          <Channel id="ch1" channel={channels.ch1} label="CH1" stereo />
          <Channel id="ch2" channel={channels.ch2} label="CH2" stereo />
          <Channel id="ch3" channel={channels.ch3} label="CH3" />
          <Channel id="ch4" channel={channels.ch4} label="CH4" />
        </div>

        {/* Master Section */}
        <div className="flex flex-col gap-1 p-1 bg-gradient-to-b from-gray-700 to-gray-800 rounded border border-gray-600">
          <span className="text-[6px] text-center text-gray-400 mixer-font">MASTER</span>
          
          <div className="flex gap-2">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[5px] text-yellow-300">LOW</span>
              <Knob value={master.low} onChange={(v) => setMaster(p => ({...p, low: v}))} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[5px] text-yellow-300">MID</span>
              <Knob value={master.mid} onChange={(v) => setMaster(p => ({...p, mid: v}))} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[5px] text-yellow-300">HI</span>
              <Knob value={master.hi} onChange={(v) => setMaster(p => ({...p, hi: v}))} />
            </div>
          </div>

          <div className="flex gap-1 mt-1">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[5px] text-gray-400">GAIN</span>
              <Knob value={master.gainL} onChange={(v) => setMaster(p => ({...p, gainL: v}))} size="sm" />
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[5px] text-gray-400">GAIN</span>
              <Knob value={master.gainR} onChange={(v) => setMaster(p => ({...p, gainR: v}))} size="sm" />
            </div>
          </div>

          <span className="text-[5px] text-yellow-300 mt-1 mixer-font">PRES</span>
          <Knob value={master.pres} onChange={(v) => setMaster(p => ({...p, pres: v}))} />

          {/* VU Master */}
          <div className="flex gap-1 mt-1">
            <div className="flex flex-col items-center">
              <div className="w-3 h-12 bg-black rounded border border-gray-600 flex flex-col-reverse overflow-hidden">
                <div className={`w-full transition-all ${getVuLedColor(vuLevelL)}`} style={{ height: `${vuLevelL * 100}%` }} />
              </div>
              <span className="text-[5px] text-gray-400">L</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-3 h-12 bg-black rounded border border-gray-600 flex flex-col-reverse overflow-hidden">
                <div className={`w-full transition-all ${getVuLedColor(vuLevelR)}`} style={{ height: `${vuLevelR * 100}%` }} />
              </div>
              <span className="text-[5px] text-gray-400">R</span>
            </div>
          </div>
        </div>

        {/* Stereo Faders */}
        <div className="flex gap-1">
          <div className="flex flex-col items-center gap-1 p-1 bg-gradient-to-b from-gray-700 to-gray-800 rounded border border-gray-600">
            <span className="text-[6px] text-gray-400">STEREO</span>
            <span className="text-[5px] text-yellow-300">L</span>
            <div className="relative h-20 w-4 bg-gray-800 rounded-full border border-gray-600">
              <div 
                className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-300 to-white rounded-full transition-all"
                style={{ height: `${(master.gainL / 100) * 100}%` }}
              />
            </div>
            <div className={`w-2 h-2 rounded-full ${vuLevelL > 0.5 ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-gray-600'}`} />
          </div>
          <div className="flex flex-col items-center gap-1 p-1 bg-gradient-to-b from-gray-700 to-gray-800 rounded border border-gray-600">
            <span className="text-[6px] text-gray-400">STEREO</span>
            <span className="text-[5px] text-yellow-300">R</span>
            <div className="relative h-20 w-4 bg-gray-800 rounded-full border border-gray-600">
              <div 
                className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-300 to-white rounded-full transition-all"
                style={{ height: `${(master.gainR / 100) * 100}%` }}
              />
            </div>
            <div className={`w-2 h-2 rounded-full ${vuLevelR > 0.5 ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-gray-600'}`} />
          </div>
        </div>

        {/* FX & AUX */}
        <div className="flex flex-col gap-1">
          <div className="flex flex-col items-center gap-0.5 p-1 bg-gradient-to-b from-gray-700 to-gray-800 rounded border border-gray-600">
            <span className="text-[5px] text-yellow-300 mixer-font">FX SEND</span>
            <Knob value={fxSend.a} onChange={(v) => setFxSend(p => ({...p, a: v}))} size="sm" />
            <Knob value={fxSend.b} onChange={(v) => setFxSend(p => ({...p, b: v}))} size="sm" />
          </div>
          <div className="flex flex-col items-center gap-0.5 p-1 bg-gradient-to-b from-gray-700 to-gray-800 rounded border border-gray-600">
            <span className="text-[5px] text-yellow-300 mixer-font">AUX</span>
            <Knob value={aux.a} onChange={(v) => setAux(p => ({...p, a: v}))} size="sm" />
            <Knob value={aux.b} onChange={(v) => setAux(p => ({...p, b: v}))} size="sm" />
          </div>
        </div>
      </div>
    </div>
  );
}

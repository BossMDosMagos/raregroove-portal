import React, { useEffect, useRef, useState } from 'react';
import { enableAudio, playBeep } from '../utils/sound.js';

export default function AcrylicLedClock() {
  const [now, setNow] = useState(() => new Date());
  const [hoverOn, setHoverOn] = useState(false);
  const on = hoverOn;
  const prevOn = useRef(on);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!prevOn.current && on) playBeep();
    prevOn.current = on;
  }, [on]);

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const text = `${hh}:${mm}`;

  return (
    <div className="hidden md:flex items-center gap-3">
      <div
        onMouseEnter={() => { enableAudio(); setHoverOn(true); }}
        onMouseLeave={() => setHoverOn(false)}
        className="led-display"
      >
        <span className={`led-text transition-opacity duration-200 tabular-nums ${on ? 'opacity-100' : 'opacity-0'}`}>{text}</span>
      </div>
    </div>
  );
}

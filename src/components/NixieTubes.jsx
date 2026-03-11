import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { enableAudio, playRelayClick } from '../utils/sound.js';

function clampInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function Tube({ digit }) {
  return (
    <div className="nixie-tube">
      <span className="nixie-number">{digit}</span>
    </div>
  );
}

export default function NixieTubes({ value = 0, digits = 6 }) {
  const [dbValue, setDbValue] = useState(null);
  const v = clampInt(typeof value === 'number' ? value : (dbValue ?? 0));
  const prev = useRef(v);

  const text = useMemo(() => String(v).padStart(digits, '0').slice(-digits), [digits, v]);
  const digitArray = useMemo(() => text.split('').map((ch) => Number(ch)), [text]);

  useEffect(() => {
    if (prev.current !== v) {
      playRelayClick();
      prev.current = v;
    }
  }, [v]);

  useEffect(() => {
    if (typeof value === 'number') return undefined;

    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from('site_stats')
        .select('id, total_visits')
        .eq('id', 1)
        .maybeSingle();

      if (cancelled) return;
      if (error) return;
      setDbValue(Number(data?.total_visits || 0));
    };

    load();

    const channel = supabase
      .channel('rg_site_stats_visits')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'site_stats',
        filter: 'id=eq.1',
      }, (payload) => {
        const next = payload?.new?.total_visits;
        if (typeof next === 'number') setDbValue(next);
        if (typeof next === 'string') setDbValue(Number(next));
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [value]);

  return (
    <button
      type="button"
      onClick={() => { enableAudio(); playRelayClick(); }}
      className="hidden md:flex items-center gap-3"
      title="Contador Nixie"
      aria-label="Contador Nixie"
    >
      <div className="nixie-base">
        <div className="nixie-container">
          {digitArray.map((d, i) => <Tube key={`${i}-${d}`} digit={d} />)}
        </div>
      </div>
    </button>
  );
}

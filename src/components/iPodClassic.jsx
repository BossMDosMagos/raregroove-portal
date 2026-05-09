import { useState, useRef, useCallback } from 'react';

const MENU = [
  { label: 'Music', icon: '♪' },
  { label: 'Artists', icon: '♫' },
  { label: 'Albums', icon: '◉' },
  { label: 'Now Playing', icon: '▶' },
  { label: 'Settings', icon: '⚙' },
];

function formatTime(s) {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function ClickWheel({ onMenu, onSelect, onPlayPause, onPrev, onNext, onVolumeSwipe }) {
  const ref = useRef(null);
  const angleRef = useRef(null);

  const getAngle = (cx, cy, x, y) => Math.atan2(y - cy, x - cx);

  const onTouchStart = (e) => {
    const r = ref.current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    angleRef.current = getAngle(cx, cy, e.touches[0].clientX, e.touches[0].clientY);
  };

  const onTouchMove = (e) => {
    if (angleRef.current === null) return;
    const r = ref.current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const a = getAngle(cx, cy, e.touches[0].clientX, e.touches[0].clientY);
    let d = a - angleRef.current;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    angleRef.current = a;
    if (Math.abs(d) > 0.05) onVolumeSwipe?.(d);
  };

  const onTouchEnd = () => { angleRef.current = null; };

  const onClick = (e) => {
    const r = ref.current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < r.width * 0.15) { onSelect?.(); return; }
    const angle = Math.atan2(dy, dx);
    if (angle > -2.36 && angle < -0.79) onMenu?.();
    else if (angle > -0.79 && angle < 0.79) onNext?.();
    else if (angle > 0.79 && angle < 2.36) onPlayPause?.();
    else onPrev?.();
  };

  return (
    <div
      ref={ref}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={onClick}
      style={{
        width: '75%',
        aspectRatio: '1',
        borderRadius: '50%',
        background: '#d4d4d4',
        boxShadow: '0 4px 15px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.5), inset 0 -3px 6px rgba(0,0,0,0.15)',
        position: 'relative',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
      }}
    >
      <div
        onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
        style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: '28%', aspectRatio: '1', borderRadius: '50%',
          background: '#b0b0b0',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 'bold', fontSize: '10px', color: '#444', zIndex: 2,
        }}
      >SELECT</div>
      <span style={{ position: 'absolute', top: '6%', left: '50%', transform: 'translateX(-50%)', fontWeight: 'bold', fontSize: '10px', color: '#555', letterSpacing: '1px' }}>MENU</span>
      <span style={{ position: 'absolute', bottom: '6%', left: '50%', transform: 'translateX(-50%)', fontSize: '14px', color: '#555' }}>▶||</span>
      <span style={{ position: 'absolute', left: '6%', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: '#555' }}>◀◀</span>
      <span style={{ position: 'absolute', right: '6%', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: '#555' }}>▶▶</span>
    </div>
  );
}

function MenuView({ items, selectedIndex }) {
  return (
    <div style={{ background: '#fff' }}>
      {items.map((item, i) => (
        <div key={item.label} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 14px',
          background: i === selectedIndex ? '#4a90d9' : '#fff',
          color: i === selectedIndex ? '#fff' : '#000',
          fontSize: '14px', fontWeight: i === selectedIndex ? '600' : '400',
          borderBottom: i < items.length - 1 ? '1px solid #e0e0e0' : 'none',
        }}>
          <span style={{ fontSize: '16px', width: '22px', textAlign: 'center' }}>{item.icon}</span>
          <span>{item.label}</span>
          {i === selectedIndex && <span style={{ marginLeft: 'auto', fontSize: '10px' }}>▸</span>}
        </div>
      ))}
    </div>
  );
}

function NowPlayingView({ currentTrack, isPlaying, currentTime, duration, volume, coverUrl }) {
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  return (
    <div style={{ padding: '8px', background: '#fff', color: '#000' }}>
      <div style={{ height: '90px', background: coverUrl ? `url(${coverUrl}) center/cover no-repeat` : '#ddd', borderRadius: '4px', marginBottom: '6px' }} />
      <div style={{ fontWeight: '600', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack?.title || 'No Track'}</div>
      <div style={{ fontSize: '11px', color: '#666' }}>{currentTrack?.artist || ''}</div>
      <div style={{ height: '3px', background: '#ddd', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#4a90d9' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#888', marginTop: '2px' }}>
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}

function AlbumsView({ albums, selectedIndex }) {
  return (
    <div style={{ background: '#fff' }}>
      {albums.map((a, i) => (
        <div key={a.id} style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
          background: i === selectedIndex ? '#4a90d9' : '#fff',
          color: i === selectedIndex ? '#fff' : '#000', fontSize: '13px',
        }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '3px', background: a.coverUrl ? `url(${a.coverUrl}) center/cover no-repeat` : '#ddd', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: '600', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
            <div style={{ fontSize: '10px', opacity: 0.7 }}>{a.artist}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function iPodClassic({ player, items = [], onPlayTrack }) {
  const [view, setView] = useState('menu');
  const [stack, setStack] = useState([]);
  const [menuIdx, setMenuIdx] = useState(0);
  const [albumIdx, setAlbumIdx] = useState(0);

  const { isPlaying, currentTrack, currentTime, duration, volume, setVolume, play, pause, playNext, playPrevious } = player;

  const handleScroll = useCallback((delta) => {
    if (view === 'menu') {
      setMenuIdx(i => Math.max(0, Math.min(MENU.length - 1, i + (delta > 0 ? 1 : -1))));
    } else if (view === 'albums') {
      setAlbumIdx(i => Math.max(0, Math.min(items.length - 1, i + (delta > 0 ? 1 : -1))));
    } else if (view === 'nowPlaying') {
      setVolume(Math.max(0, Math.min(1, (volume ?? 0.7) + delta * 0.5)));
    }
  }, [view, items.length, volume, setVolume]);

  const handleMenu = useCallback(() => {
    if (stack.length > 0) {
      const prev = stack[stack.length - 1];
      setStack(s => s.slice(0, -1));
      setView(prev);
    } else {
      setView('menu');
      setMenuIdx(0);
    }
  }, [stack]);

  const handleSelect = useCallback(() => {
    if (view === 'menu') {
      const label = MENU[menuIdx].label;
      if (label === 'Now Playing') { setStack(s => [...s, 'menu']); setView('nowPlaying'); return; }
      if (label === 'Albums' || label === 'Music' || label === 'Artists') { setStack(s => [...s, 'menu']); setView('albums'); setAlbumIdx(0); return; }
    } else if (view === 'albums') {
      const album = items[albumIdx];
      if (album) { onPlayTrack?.(album, 0); setStack(s => [...s, 'albums']); setView('nowPlaying'); }
    }
  }, [view, menuIdx, albumIdx, items, stack, onPlayTrack]);

  const handlePlayPause = useCallback(() => { if (isPlaying) pause(); else play(); }, [isPlaying, play, pause]);

  const coverUrl = (() => {
    if (currentTrack?.coverUrl) return currentTrack.coverUrl;
    if (currentTrack?.albumId) { const a = items.find(x => x.id === currentTrack.albumId); return a?.coverUrl || null; }
    return null;
  })();

  const screenContent = () => {
    try {
      switch (view) {
        case 'nowPlaying': return <NowPlayingView currentTrack={currentTrack} isPlaying={isPlaying} currentTime={currentTime} duration={duration} volume={volume} coverUrl={coverUrl} />;
        case 'albums': return <AlbumsView albums={items} selectedIndex={albumIdx} />;
        default: return <MenuView items={MENU} selectedIndex={menuIdx} />;
      }
    } catch (e) {
      return <div style={{ padding: '14px', color: '#000', fontSize: '12px', textAlign: 'center' }}>Carregando Biblioteca...</div>;
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', overflow: 'hidden', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', zIndex: 2147483647 }}>
      {/* Chassis */}
      <div style={{ width: '100%', maxWidth: '300px', background: '#f0f0f0', borderRadius: '28px', padding: '12px 12px 8px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
        {/* Screen */}
        <div style={{ background: '#fff', borderRadius: '6px', border: '2px solid #888', overflow: 'hidden' }}>
          {/* Status bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 8px', fontSize: '10px', color: '#444', background: '#eee', borderBottom: '1px solid #ccc' }}>
            <span>{currentTrack?.title || 'Grooveflix'}</span>
            <span>{isPlaying && '▶'} {Math.round((volume ?? 0.7) * 100)}%</span>
          </div>
          {/* Content */}
          <div style={{ minHeight: '160px', background: '#fff' }}>
            {screenContent()}
          </div>
        </div>
        {/* ClickWheel */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 2px' }}>
          <ClickWheel onMenu={handleMenu} onSelect={handleSelect} onPlayPause={handlePlayPause} onPrev={playPrevious} onNext={playNext} onVolumeSwipe={handleScroll} />
        </div>
      </div>
    </div>
  );
}

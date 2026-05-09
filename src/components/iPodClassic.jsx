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

function MenuView({ items, selectedIndex }) {
  return (
    <div style={{ background: '#bcc6cc' }}>
      {items.map((item, i) => (
        <div key={item.label} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '3px 6px', margin: '2px 0',
          background: i === selectedIndex ? '#000' : 'transparent',
          color: i === selectedIndex ? '#fff' : '#000',
          fontSize: '12px', fontWeight: 'bold',
        }}>
          <span style={{ width: '16px', textAlign: 'center', fontSize: '12px' }}>{item.icon}</span>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function NowPlayingView({ currentTrack, isPlaying, currentTime, duration, coverUrl }) {
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  return (
    <div style={{ background: '#bcc6cc', color: '#000', fontSize: '11px', padding: '4px' }}>
      <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {currentTrack?.title || 'No Track'}
      </div>
      <div style={{ marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {currentTrack?.artist || ''}
      </div>
      <div style={{ height: '4px', background: '#999', borderRadius: '2px', overflow: 'hidden', margin: '4px 0 2px' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#000' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}

function AlbumsView({ albums, selectedIndex }) {
  return (
    <div style={{ background: '#bcc6cc', fontSize: '11px' }}>
      {albums.map((a, i) => (
        <div key={a.id} style={{
          display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 6px',
          background: i === selectedIndex ? '#000' : 'transparent',
          color: i === selectedIndex ? '#fff' : '#000', fontWeight: 'bold',
        }}>
          <div style={{
            width: '18px', height: '18px', borderRadius: '2px',
            background: a.coverUrl ? `url(${a.coverUrl}) center/cover` : '#999',
            flexShrink: 0,
          }} />
          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {a.title}
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

  const wheelRef = useRef(null);
  const angleRef = useRef(null);

  const getAngle = (cx, cy, x, y) => Math.atan2(y - cy, x - cx);

  const onWheelTouchStart = (e) => {
    const r = wheelRef.current.getBoundingClientRect();
    angleRef.current = getAngle(r.left + r.width / 2, r.top + r.height / 2, e.touches[0].clientX, e.touches[0].clientY);
  };

  const onWheelTouchMove = (e) => {
    if (angleRef.current === null) return;
    const r = wheelRef.current.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const a = getAngle(cx, cy, e.touches[0].clientX, e.touches[0].clientY);
    let d = a - angleRef.current;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    angleRef.current = a;
    if (Math.abs(d) > 0.05) handleScroll(d);
  };

  const onWheelTouchEnd = () => { angleRef.current = null; };

  const onWheelClick = (e) => {
    const r = wheelRef.current.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < r.width * 0.15) { handleSelect(); return; }
    const angle = Math.atan2(dy, dx);
    if (angle > -2.36 && angle < -0.79) handleMenu();
    else if (angle > -0.79 && angle < 0.79) playNext?.();
    else if (angle > 0.79 && angle < 2.36) handlePlayPause();
    else playPrevious?.();
  };

  const renderContent = () => {
    try {
      switch (view) {
        case 'nowPlaying': return <NowPlayingView currentTrack={currentTrack} isPlaying={isPlaying} currentTime={currentTime} duration={duration} coverUrl={coverUrl} />;
        case 'albums': return <AlbumsView albums={items} selectedIndex={albumIdx} />;
        default: return <MenuView items={MENU} selectedIndex={menuIdx} />;
      }
    } catch { return <div style={{ padding: '8px', color: '#000', fontSize: '11px' }}>Carregando...</div>; }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', overflow: 'hidden', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2147483647 }}>
      <div style={{ width: '200px', height: '320px', background: '#6a5acd', borderRadius: '20px', padding: '20px', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5), 5px 10px 20px rgba(0,0,0,0.3)', border: '2px solid #5a4bbf' }}>
        <div style={{ background: '#000', padding: '10px', borderRadius: '10px', marginBottom: '25px' }}>
          <div style={{ background: '#bcc6cc', height: '120px', borderRadius: '5px', padding: '8px', color: '#000', fontWeight: 'bold', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', borderBottom: '1px solid #000', paddingBottom: '3px', marginBottom: '6px' }}>
              <span>{currentTrack?.title ? formatTime(currentTime) : '9:41'}</span>
              <span>{isPlaying ? '▶' : '🎧'}</span>
            </div>
            <div style={{ height: '85px', overflow: 'hidden' }}>
              {renderContent()}
            </div>
          </div>
        </div>
        <div
          ref={wheelRef}
          onTouchStart={onWheelTouchStart}
          onTouchMove={onWheelTouchMove}
          onTouchEnd={onWheelTouchEnd}
          onClick={onWheelClick}
          style={{
            width: '140px', height: '140px', background: '#fff', borderRadius: '50%',
            margin: '0 auto', position: 'relative',
            boxShadow: 'inset 0 0 5px rgba(0,0,0,0.2)',
            cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none',
          }}
        >
          <div style={{
            width: '50px', height: '50px', background: '#f0f0f0', borderRadius: '50%',
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            boxShadow: '0 0 5px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '9px', fontWeight: 'bold', color: '#555', zIndex: 2, cursor: 'pointer',
          }} onClick={(e) => { e.stopPropagation(); handleSelect(); }}>
            OK
          </div>
          <div style={{ position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', fontWeight: 'bold', fontSize: '10px', color: '#555' }}>MENU</div>
          <div style={{ position: 'absolute', top: '50%', right: '12px', transform: 'translateY(-50%)', fontSize: '12px', color: '#555' }}>▶▶</div>
          <div style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', fontSize: '12px', color: '#555' }}>◀◀</div>
          <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', fontSize: '10px', color: '#555', display: 'flex', gap: '2px' }}>
            <span style={{ display: 'inline-block', width: '4px', height: '8px', background: '#555' }} />
            <span style={{ display: 'inline-block', width: '4px', height: '8px', background: '#555' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

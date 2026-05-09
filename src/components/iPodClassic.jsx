import { useState, useRef, useCallback, useEffect } from 'react';

const MENU_ITEMS = [
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
  const wheelRef = useRef(null);
  const touchAngleRef = useRef(null);

  const getAngle = (cx, cy, x, y) => Math.atan2(y - cy, x - cx);

  const handleTouchStart = (e) => {
    const rect = wheelRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const touch = e.touches[0];
    touchAngleRef.current = getAngle(cx, cy, touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e) => {
    if (touchAngleRef.current === null) return;
    const rect = wheelRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const touch = e.touches[0];
    const newAngle = getAngle(cx, cy, touch.clientX, touch.clientY);
    let delta = newAngle - touchAngleRef.current;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    touchAngleRef.current = newAngle;
    if (Math.abs(delta) > 0.05) {
      onVolumeSwipe?.(delta);
    }
  };

  const handleTouchEnd = () => {
    touchAngleRef.current = null;
  };

  const handleTap = (e) => {
    const rect = wheelRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const wheelRadius = rect.width / 2;
    const centerRadius = wheelRadius * 0.35;

    // Center button (Select)
    if (dist < centerRadius) {
      onSelect?.();
      return;
    }

    const angle = Math.atan2(dy, dx);
    // Top: MENU (angle between -PI/4 and PI/4 from vertical)
    // Buttons are at 45-degree positions:
    // Top: MENU (angle -PI/2)
    // Right: Next (angle 0)
    // Bottom: Play/Pause (angle PI/2)  
    // Left: Prev (angle PI or -PI)

    if (angle > -Math.PI * 0.75 && angle < -Math.PI * 0.25) {
      onMenu?.();
    } else if (angle > -Math.PI * 0.25 && angle < Math.PI * 0.25) {
      onNext?.();
    } else if (angle > Math.PI * 0.25 && angle < Math.PI * 0.75) {
      onPlayPause?.();
    } else {
      onPrev?.();
    }
  };

  return (
    <div
      ref={wheelRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleTap}
      style={{
        position: 'relative',
        width: '75%',
        aspectRatio: '1',
        borderRadius: '50%',
        background: 'linear-gradient(145deg, #e8e8e8, #c0c0c0)',
        boxShadow: '0 4px 15px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.15)',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
      }}
    >
      {/* Center button */}
      <div
        onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '28%',
          aspectRatio: '1',
          borderRadius: '50%',
          background: 'linear-gradient(145deg, #d0d0d0, #a8a8a8)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: 'clamp(10px, 2.5vw, 14px)',
          color: '#555',
          zIndex: 2,
        }}
      >
        SELECT
      </div>

      {/* Button labels */}
      <span style={{ position: 'absolute', top: '6%', left: '50%', transform: 'translateX(-50%)', fontSize: 'clamp(9px, 2vw, 12px)', fontWeight: 'bold', color: '#666', letterSpacing: '1px' }}>MENU</span>
      <span style={{ position: 'absolute', bottom: '6%', left: '50%', transform: 'translateX(-50%)', fontSize: 'clamp(14px, 3vw, 18px)', color: '#666' }}>▶||</span>
      <span style={{ position: 'absolute', left: '6%', top: '50%', transform: 'translateY(-50%)', fontSize: 'clamp(14px, 3vw, 18px)', color: '#666' }}>◀◀</span>
      <span style={{ position: 'absolute', right: '6%', top: '50%', transform: 'translateY(-50%)', fontSize: 'clamp(14px, 3vw, 18px)', color: '#666' }}>▶▶</span>
    </div>
  );
}

function MenuView({ items, selectedIndex }) {
  return (
    <div style={{ padding: '8px 0' }}>
      {items.map((item, i) => (
        <div
          key={item.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            background: i === selectedIndex ? 'linear-gradient(180deg, #4a90d9, #357abd)' : 'transparent',
            color: i === selectedIndex ? '#fff' : '#222',
            borderRadius: '4px',
            margin: '0 6px',
            fontSize: 'clamp(13px, 3vw, 16px)',
            fontWeight: i === selectedIndex ? '600' : '400',
          }}
        >
          <span style={{ fontSize: 'clamp(16px, 3.5vw, 20px)', width: '24px', textAlign: 'center' }}>{item.icon}</span>
          <span>{item.label}</span>
          {i === selectedIndex && (
            <span style={{ marginLeft: 'auto', fontSize: '10px' }}>▸</span>
          )}
        </div>
      ))}
    </div>
  );
}

function NowPlayingView({ currentTrack, isPlaying, currentTime, duration, volume, coverUrl }) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '10px' }}>
      {/* Album Art */}
      <div style={{
        flex: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 0,
      }}>
        <div style={{
          width: '65%',
          aspectRatio: '1',
          borderRadius: '6px',
          background: coverUrl
            ? `url(${coverUrl}) center/cover no-repeat`
            : 'linear-gradient(135deg, #667eea, #764ba2)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 'clamp(24px, 5vw, 36px)',
        }}>
          {!coverUrl && '♫'}
        </div>
      </div>

      {/* Track Info */}
      <div style={{ padding: '8px 0 4px', textAlign: 'center' }}>
        <div style={{
          fontSize: 'clamp(12px, 2.8vw, 15px)',
          fontWeight: '600',
          color: '#222',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {currentTrack?.title || 'No Track'}
        </div>
        <div style={{
          fontSize: 'clamp(10px, 2.2vw, 12px)',
          color: '#666',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {currentTrack?.artist || ''}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ padding: '2px 0 6px' }}>
        <div style={{
          height: '4px',
          background: '#ddd',
          borderRadius: '2px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #4a90d9, #357abd)',
            borderRadius: '2px',
            transition: 'width 0.3s linear',
          }} />
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 'clamp(8px, 1.8vw, 10px)',
          color: '#888',
          marginTop: '2px',
        }}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

function AlbumsView({ albums, selectedIndex, onSelect }) {
  return (
    <div style={{ padding: '8px 0', overflowY: 'auto', height: '100%' }}>
      {albums.map((album, i) => (
        <div
          key={album.id}
          onClick={() => onSelect?.(album, i)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            background: i === selectedIndex ? 'linear-gradient(180deg, #4a90d9, #357abd)' : 'transparent',
            color: i === selectedIndex ? '#fff' : '#222',
            borderRadius: '4px',
            margin: '0 6px',
            fontSize: 'clamp(12px, 2.5vw, 14px)',
          }}
        >
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '4px',
            background: album.coverUrl
              ? `url(${album.coverUrl}) center/cover no-repeat`
              : 'linear-gradient(135deg, #667eea, #764ba2)',
            flexShrink: 0,
          }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{album.title}</div>
            <div style={{ fontSize: 'clamp(9px, 2vw, 11px)', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{album.artist}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function iPodClassic({ player, items = [], onPlayTrack }) {
  const [currentView, setCurrentView] = useState('menu');
  const [viewStack, setViewStack] = useState([]);
  const [menuIndex, setMenuIndex] = useState(0);
  const [albumIndex, setAlbumIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);

  const {
    isPlaying, currentTrack, currentTime, duration,
    volume, setVolume, play, pause, playNext, playPrevious,
    queue, seek,
  } = player;

  // Click Wheel navigation: scroll moves selection
  const handleVolumeSwipe = useCallback((delta) => {
    if (currentView === 'nowPlaying') {
      // Swipe on wheel adjusts volume when in Now Playing
      setVolume(Math.max(0, Math.min(1, (volume ?? 0.7) + delta * 0.5)));
    } else if (currentView === 'menu') {
      const newIdx = Math.max(0, Math.min(MENU_ITEMS.length - 1, menuIndex + (delta > 0 ? 1 : -1)));
      setMenuIndex(newIdx);
    } else if (currentView === 'albums') {
      const newIdx = Math.max(0, Math.min(items.length - 1, albumIndex + (delta > 0 ? 1 : -1)));
      setAlbumIndex(newIdx);
    }
  }, [currentView, menuIndex, albumIndex, items.length, volume, setVolume]);

  const handleMenu = useCallback(() => {
    if (viewStack.length > 0) {
      const prev = viewStack[viewStack.length - 1];
      setViewStack(viewStack.slice(0, -1));
      setCurrentView(prev);
    } else {
      setCurrentView('menu');
      setMenuIndex(0);
    }
  }, [viewStack]);

  const handleSelect = useCallback(() => {
    if (currentView === 'menu') {
      const label = MENU_ITEMS[menuIndex].label;
      if (label === 'Now Playing') {
        setViewStack([...viewStack, 'menu']);
        setCurrentView('nowPlaying');
        return;
      }
      if (label === 'Albums') {
        setViewStack([...viewStack, 'menu']);
        setCurrentView('albums');
        setAlbumIndex(0);
        return;
      }
      if (label === 'Music') {
        setViewStack([...viewStack, 'menu']);
        setCurrentView('albums');
        setAlbumIndex(0);
        return;
      }
      if (label === 'Artists') {
        setViewStack([...viewStack, 'menu']);
        setCurrentView('albums');
        setAlbumIndex(0);
        return;
      }
    } else if (currentView === 'albums') {
      const album = items[albumIndex];
      if (album) {
        onPlayTrack?.(album, 0);
        setViewStack([...viewStack, currentView]);
        setCurrentView('nowPlaying');
      }
    }
  }, [currentView, menuIndex, albumIndex, items, viewStack, onPlayTrack]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);

  const getCoverUrl = () => {
    if (currentTrack?.coverUrl) return currentTrack.coverUrl;
    if (currentTrack?.albumId) {
      const album = items.find(a => a.id === currentTrack.albumId);
      return album?.coverUrl || null;
    }
    return null;
  };

  const renderScreen = () => {
    switch (currentView) {
      case 'menu':
        return <MenuView items={MENU_ITEMS} selectedIndex={menuIndex} />;
      case 'nowPlaying':
        return (
          <NowPlayingView
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            coverUrl={getCoverUrl()}
          />
        );
      case 'albums':
        return (
          <AlbumsView
            albums={items}
            selectedIndex={albumIndex}
            onSelect={(album, i) => {
              setAlbumIndex(i);
              onPlayTrack?.(album, 0);
              setViewStack([...viewStack, currentView]);
              setCurrentView('nowPlaying');
            }}
          />
        );
      default:
        return <MenuView items={MENU_ITEMS} selectedIndex={menuIndex} />;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'linear-gradient(180deg, #3a3a3a 0%, #1a1a1a 50%, #2a2a2a 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      overflow: 'hidden',
    }}>
      {/* Chassis */}
      <div style={{
        width: 'min(85vw, 320px)',
        height: 'calc(min(85vw, 320px) * 16 / 9)',
        maxHeight: '92vh',
        background: 'linear-gradient(145deg, #f0f0f0, #d0d0d0, #e8e8e8)',
        borderRadius: '36px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.6)',
        display: 'flex',
        flexDirection: 'column',
        padding: 'clamp(12px, 3vw, 20px)',
        position: 'relative',
      }}>
        {/* Screen */}
        <div style={{
          flex: '1 1 0',
          minHeight: 0,
          background: '#f5f5f5',
          borderRadius: '12px',
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: 'inset 0 0 0 2px #888, inset 0 0 0 4px #333, inset 0 0 0 1px #666',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          marginBottom: 'clamp(6px, 1.5vw, 10px)',
          position: 'relative',
        }}>
          {/* Status bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 10px',
            fontSize: 'clamp(8px, 1.8vw, 10px)',
            color: '#555',
            fontWeight: '600',
            borderBottom: '1px solid #e0e0e0',
            flexShrink: 0,
          }}>
            <span>{currentTrack?.title || 'Grooveflix'}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {isPlaying && <span style={{ fontSize: '6px' }}>▶</span>}
              <span>{Math.round((volume ?? 0.7) * 100)}%</span>
            </span>
          </div>
          {/* Screen content */}
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            {renderScreen()}
          </div>
        </div>

        {/* Click Wheel area */}
        <div style={{
          flex: '0 0 auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 'clamp(4px, 1vw, 8px) 0',
        }}>
          <ClickWheel
            onMenu={handleMenu}
            onSelect={handleSelect}
            onPlayPause={handlePlayPause}
            onPrev={playPrevious}
            onNext={playNext}
            onVolumeSwipe={handleVolumeSwipe}
          />
        </div>

        {/* Dock connector detail */}
        <div style={{
          position: 'absolute',
          bottom: 'clamp(4px, 1vw, 8px)',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '30%',
          height: '3px',
          background: '#999',
          borderRadius: '2px',
          opacity: 0.3,
        }} />
      </div>
    </div>
  );
}

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
    <div style={{ background: '#fff', padding: '6px 0' }}>
      {items.map((item, i) => (
        <div
          key={item.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 12px',
            background: i === selectedIndex ? '#4a90d9' : '#fff',
            color: i === selectedIndex ? '#fff' : '#000',
            fontSize: '14px',
            fontWeight: i === selectedIndex ? '600' : '400',
          }}
        >
          <span style={{ fontSize: '16px', width: '22px', textAlign: 'center' }}>{item.icon}</span>
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '10px', background: '#fff' }}>
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
            : '#ddd',
          boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
          fontSize: '24px',
        }}>
          {!coverUrl && '♫'}
        </div>
      </div>

      {/* Track Info */}
      <div style={{ padding: '8px 0 4px', textAlign: 'center' }}>
        <div style={{
          fontSize: '13px',
          fontWeight: '600',
          color: '#000',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {currentTrack?.title || 'No Track'}
        </div>
        <div style={{
          fontSize: '11px',
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
            background: '#4a90d9',
            borderRadius: '2px',
            transition: 'width 0.3s linear',
          }} />
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '9px',
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
    <div style={{ background: '#fff', padding: '4px 0', overflowY: 'auto', height: '100%' }}>
      {albums.map((album, i) => (
        <div
          key={album.id}
          onClick={() => onSelect?.(album, i)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 12px',
            background: i === selectedIndex ? '#4a90d9' : '#fff',
            color: i === selectedIndex ? '#fff' : '#000',
            fontSize: '13px',
          }}
        >
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '4px',
            background: album.coverUrl
              ? `url(${album.coverUrl}) center/cover no-repeat`
              : '#ddd',
            flexShrink: 0,
          }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: '600', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{album.title}</div>
            <div style={{ fontSize: '10px', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{album.artist}</div>
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
      background: '#1a1a1a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12px',
    }}>
      {/* Chassis */}
      <div style={{
        width: '100%',
        maxWidth: '300px',
        background: 'linear-gradient(145deg, #eaeaea 0%, #cccccc 50%, #e0e0e0 100%)',
        borderRadius: '30px',
        padding: '14px 14px 10px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}>
        {/* Screen */}
        <div style={{
          background: '#fff',
          borderRadius: '8px',
          border: '2px solid #888',
          outline: '4px solid #333',
          overflow: 'hidden',
        }}>
          {/* Status bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '2px 8px',
            fontSize: '9px',
            color: '#555',
            fontWeight: '600',
            background: '#f0f0f0',
            borderBottom: '1px solid #ccc',
          }}>
            <span>{currentTrack?.title || 'Grooveflix'}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              {isPlaying && <span>▶</span>}
              <span>{Math.round((volume ?? 0.7) * 100)}%</span>
            </span>
          </div>
          {/* Screen content */}
          <div style={{ background: '#fff', minHeight: '170px' }}>
            {renderScreen()}
          </div>
        </div>

        {/* Click Wheel */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '6px 0 2px',
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
      </div>
    </div>
  );
}

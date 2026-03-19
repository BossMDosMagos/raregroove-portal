import { useEffect, useState } from 'react';

export function useServiceWorker() {
  const [isSupported, setIsSupported] = useState(false);
  const [registration, setRegistration] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      setIsSupported(true);
      
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);
      });

      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.log('[SW] Registered:', reg.scope);
        setRegistration(reg);

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
              }
            });
          }
        });
      }).catch((error) => {
        console.error('[SW] Registration failed:', error);
      });
    }

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const skipWaiting = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  };

  const clearCache = () => {
    if (registration?.active) {
      registration.active.postMessage({ type: 'CLEAR_CACHE' });
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  };

  const subscribeToPush = async (userId) => {
    if (!isSupported || !registration) return null;

    try {
      const permission = await requestNotificationPermission();
      if (!permission) return null;

      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        return existingSubscription;
      }

      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.warn('VAPID public key not configured');
        return null;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          subscription: subscription.toJSON(),
        }),
      });

      return subscription;
    } catch (error) {
      console.error('Push subscription failed:', error);
      return null;
    }
  };

  return {
    isSupported,
    registration,
    updateAvailable,
    isOffline,
    skipWaiting,
    clearCache,
    requestNotificationPermission,
    subscribeToPush,
  };
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function OfflineBanner() {
  const { isOffline } = useServiceWorker();

  if (!isOffline) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-amber-500 text-black px-4 py-2 text-center text-sm font-medium z-50">
      Você está offline. Algumas funcionalidades podem estar limitadas.
    </div>
  );
}

export function UpdateBanner({ onUpdate }) {
  const { updateAvailable } = useServiceWorker();

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-zinc-800 border border-amber-500 rounded-lg p-4 shadow-xl z-50">
      <h3 className="font-bold text-white mb-2">Atualização disponível</h3>
      <p className="text-sm text-zinc-400 mb-4">
        Uma nova versão do RareGroove está disponível.
      </p>
      <button
        onClick={onUpdate}
        className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg transition-colors"
      >
        Atualizar agora
      </button>
    </div>
  );
}

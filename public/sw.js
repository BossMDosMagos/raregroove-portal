const CACHE_NAME = 'raregroove-v1';
const STATIC_ASSETS = [
  '/',
  '/catalog',
  '/index.html',
];

const API_CACHE_NAME = 'raregroove-api-v1';
const CACHEABLE_API_ROUTES = [
  '/catalog',
  '/api/genres',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== API_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (url.origin === location.origin) {
    if (STATIC_ASSETS.some(asset => url.pathname === asset || url.pathname.endsWith(asset))) {
      event.respondWith(cacheFirst(request));
      return;
    }

    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/catalog')) {
      event.respondWith(networkFirst(request, API_CACHE_NAME));
      return;
    }

    event.respondWith(networkFirst(request, CACHE_NAME));
    return;
  }

  if (url.origin.includes('supabase.co')) {
    event.respondWith(networkFirst(request, API_CACHE_NAME, {
      headers: {
        'Cache-Control': 'public, max-age=300',
      }
    }));
    return;
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request, cacheName, options = {}) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    if (request.destination === 'document') {
      return caches.match('/index.html') || new Response(
        '<html><body><h1>Offline</h1><p>Você está offline. Verifique sua conexão.</p></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    return new Response('Offline', { status: 503 });
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-cart') {
    event.waitUntil(syncCart());
  }

  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

async function syncCart() {
  try {
    const response = await fetch('/api/cart/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pendingItems: await getPendingCartItems()
      })
    });
    return response.ok;
  } catch (error) {
    console.error('Cart sync failed:', error);
    return false;
  }
}

async function syncMessages() {
  try {
    await self.registration.sync.register('sync-messages');
  } catch (error) {
    console.error('Messages sync registration failed:', error);
  }
}

async function getPendingCartItems() {
  return [];
}

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  
  const options = {
    body: data.body || data.message,
    icon: '/img/icon-192x192.png',
    badge: '/img/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      id: data.id,
      type: data.type,
    },
    actions: data.actions || [
      { action: 'view', title: 'Ver' },
      { action: 'dismiss', title: 'Dispensar' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'RareGroove', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  if (action === 'dismiss') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === data.url && 'focus' in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(data.url);
      }
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event.notification.data);
});

self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(cacheNames.map((name) => caches.delete(name)));
      })
    );
  }

  if (event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

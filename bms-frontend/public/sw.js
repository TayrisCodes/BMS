// Service Worker for BMS PWA
// Caches static assets and API responses for offline support

const CACHE_NAME = 'bms-v1';
const STATIC_CACHE_NAME = 'bms-static-v1';
const API_CACHE_NAME = 'bms-api-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/tenant/dashboard',
  '/tenant/invoices',
  '/tenant/payments',
  '/tenant/complaints',
  '/tenant/lease',
  '/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((error) => {
        console.warn('[Service Worker] Failed to cache some assets:', error);
      });
    }),
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName !== STATIC_CACHE_NAME &&
            cacheName !== API_CACHE_NAME &&
            cacheName !== CACHE_NAME
          ) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  // Take control of all clients immediately
  return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          // Return cached response if available and not too old (5 minutes)
          if (cachedResponse) {
            const cachedDate = cachedResponse.headers.get('sw-cached-date');
            if (cachedDate) {
              const cacheAge = Date.now() - parseInt(cachedDate, 10);
              if (cacheAge < 5 * 60 * 1000) {
                // Less than 5 minutes old
                return cachedResponse;
              }
            }
          }

          // Fetch from network
          return fetch(request)
            .then((response) => {
              // Clone response for caching
              const responseToCache = response.clone();

              // Add cache date header
              const headers = new Headers(responseToCache.headers);
              headers.set('sw-cached-date', Date.now().toString());

              const modifiedResponse = new Response(responseToCache.body, {
                status: responseToCache.status,
                statusText: responseToCache.statusText,
                headers: headers,
              });

              // Cache successful responses
              if (response.status === 200) {
                cache.put(request, modifiedResponse);
              }
              return response;
            })
            .catch(() => {
              // If network fails and we have cached response, use it
              if (cachedResponse) {
                return cachedResponse;
              }
              // Return offline fallback for API requests
              return new Response(
                JSON.stringify({ error: 'Offline', message: 'No internet connection' }),
                {
                  status: 503,
                  headers: { 'Content-Type': 'application/json' },
                },
              );
            });
        });
      }),
    );
    return;
  }

  // Handle static assets (HTML, CSS, JS, images)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone response for caching
          const responseToCache = response.clone();

          caches.open(STATIC_CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          // Offline fallback - return a basic offline page for navigation requests
          if (request.headers.get('accept').includes('text/html')) {
            return caches.match('/offline.html').then((offlinePage) => {
              return offlinePage || new Response('Offline', { status: 503 });
            });
          }
        });
    }),
  );
});

// Background sync for offline actions (if supported)
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);

  if (event.tag === 'sync-complaints') {
    event.waitUntil(syncComplaints());
  } else if (event.tag === 'sync-payments') {
    event.waitUntil(syncPayments());
  }
});

// Sync queued complaints
async function syncComplaints() {
  // This would sync queued complaints from IndexedDB
  // For MVP, this is a placeholder
  console.log('[Service Worker] Syncing complaints...');
}

// Sync queued payments
async function syncPayments() {
  // This would sync queued payment intents from IndexedDB
  // For MVP, this is a placeholder
  console.log('[Service Worker] Syncing payments...');
}

// Push notifications (for future use)
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');
  // Handle push notifications here
});

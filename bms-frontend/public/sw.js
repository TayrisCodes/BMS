// Service Worker for PWA and Push Notifications
// Enhanced with better caching strategies

const CACHE_VERSION = 'v2';
const CACHE_NAME = `bms-${CACHE_VERSION}`;
const STATIC_CACHE = `bms-static-${CACHE_VERSION}`;
const API_CACHE = `bms-api-${CACHE_VERSION}`;
const OFFLINE_PAGE = '/offline';

// URLs to cache on install
const urlsToCache = [
  '/',
  '/tenant',
  '/tenant/dashboard',
  OFFLINE_PAGE,
  '/icon-192.png',
  '/icon-512.png',
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      }),
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[SW] Static cache ready');
        return Promise.resolve();
      }),
    ]).catch((error) => {
      console.error('[SW] Install failed:', error);
    }),
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old caches that don't match current version
            if (
              cacheName.startsWith('bms-') &&
              cacheName !== CACHE_NAME &&
              cacheName !== STATIC_CACHE &&
              cacheName !== API_CACHE
            ) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      }),
  );
});

// Helper function to check if request is for static asset
function isStaticAsset(url) {
  return (
    url.match(/\.(jpg|jpeg|png|gif|svg|webp|ico|woff|woff2|ttf|eot|css|js)$/i) ||
    url.includes('/_next/static/') ||
    url.includes('/icon-') ||
    url.includes('/images/')
  );
}

// Helper function to check if request is for API
function isApiRequest(url) {
  return url.includes('/api/');
}

// Helper function to check if request is for HTML page
function isHtmlRequest(url) {
  return (
    url.endsWith('/') ||
    url.endsWith('.html') ||
    (!url.includes('.') && !isApiRequest(url) && !isStaticAsset(url))
  );
}

// Fetch event - implement different caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Strategy 1: Cache-first for static assets (images, fonts, CSS, JS)
  if (isStaticAsset(url.href)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request)
            .then((response) => {
              // Cache successful responses
              if (response.status === 200) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => {
              // Return cached version even if stale
              return cachedResponse;
            });
        });
      }),
    );
    return;
  }

  // Strategy 2: Network-first with cache fallback for API calls
  if (isApiRequest(url.href)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses (with short TTL)
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return offline response for API calls
            return new Response(
              JSON.stringify({ error: 'Offline', message: 'No internet connection' }),
              {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
              },
            );
          });
        }),
    );
    return;
  }

  // Strategy 3: Stale-while-revalidate for HTML pages
  if (isHtmlRequest(url.href)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          // Fetch fresh content in background
          const fetchPromise = fetch(request)
            .then((response) => {
              if (response.status === 200) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => {
              // If fetch fails and we have cached version, return it
              if (cachedResponse) {
                return cachedResponse;
              }
              // Otherwise, return offline page
              return caches.match(OFFLINE_PAGE);
            });

          // Return cached version immediately if available, otherwise wait for network
          return cachedResponse || fetchPromise;
        });
      }),
    );
    return;
  }

  // Default: Network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback to offline page for navigation requests
          if (request.mode === 'navigate') {
            return caches.match(OFFLINE_PAGE);
          }
          return new Response('Offline', { status: 503 });
        });
      }),
  );
});

// Push event - handle push notifications
self.addEventListener('push', (event) => {
  let notificationData = {
    title: 'BMS Notification',
    body: 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'bms-notification',
    data: {},
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        tag: data.tag || notificationData.tag,
        data: data.data || notificationData.data,
        requireInteraction: data.requireInteraction || false,
        silent: data.silent || false,
      };
    } catch (error) {
      console.error('[SW] Failed to parse push notification data:', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      data: notificationData.data,
      requireInteraction: notificationData.requireInteraction,
      silent: notificationData.silent,
      vibrate: [200, 100, 200],
    }),
  );
});

// Notification click event - open app when notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const urlToOpen = data.url || '/tenant/dashboard';

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // Check if there's already a window/tab open with the target URL
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new window/tab
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      }),
  );
});

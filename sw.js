const CACHE_NAME = 'todo-pwa-v6'; // Обновляем версию кэша
const urlsToCache = [
  './index.html',
  './qr.html',
  './offline.html',
  './manifest.json',
  './styles.css',
  './jsQR.js',
  './qr.js',
  './script.js',
  './jquery.min.js',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

self.addEventListener('install', function(event) {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Opened cache');
        // Кэшируем ресурсы по одному, чтобы избежать сбоя всего процесса из-за одного проблемного ресурса
        const cachePromises = urlsToCache.map(function(url) {
          // Преобразуем относительный путь в абсолютный URL для корректного запроса
          try {
            const absoluteUrl = new URL(url, self.location).href;
            return fetch(absoluteUrl)
              .then(function(response) {
                // Проверяем, успешен ли ответ
                if (!response.ok) {
                  console.warn(`Failed to fetch ${url} - Status: ${response.status}`);
                  return Promise.resolve(); // Не прерываем весь процесс кэширования
                }
                // Добавляем в кэш только успешные ответы
                return cache.put(url, response);
              })
              .catch(function(error) {
                console.warn(`Failed to cache ${url}:`, error);
                // Не прерываем весь процесс кэширования из-за одной ошибки
                return Promise.resolve(); // Не прерываем весь процесс кэширования
              });
          } catch (e) {
            console.warn(`Invalid URL to cache ${url}:`, e);
            // Не прерываем весь процесс кэширования из-за одной ошибки
            return Promise.resolve(); // Не прерываем весь процесс кэширования
          }
        });
        
        return Promise.all(cachePromises);
      })
      .then(function() {
        console.log('All resources attempted to cache');
        // Пропускаем этап ожидания, чтобы сервис-воркер сразу стал активным
        return self.skipWaiting();
      })
      .catch(function(error) {
        console.error('Failed to cache:', error);
      })
  );
});

self.addEventListener('fetch', function(event) {
  // Для навигационных запросов возвращаем кэшированный index.html или qr.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request.url)
        .then(response => {
          // Если есть кэшированная версия конкретного URL, используем её
          if (response) {
            return response;
          }
          
          // Иначе проверяем, является ли это запросом к главной странице или qr.html
          try {
            const url = new URL(event.request.url);
            if (url.pathname === '/' || url.pathname === '/index.html' || url.search.includes('pwa=true')) {
              // Проверяем, есть ли кэшированная версия index.html
              return caches.match('./index.html')
                .then(response => {
                  if (response) {
                    return response;
                  }
                  // Если index.html не закэширован, возвращаем offline.html
                  return caches.match('./offline.html');
                });
            } else if (url.pathname.includes('qr.html')) {
              return caches.match('./qr.html');
            }
          } catch (e) {
            console.error('URL parsing error:', e);
          }
          
          // Если ничего не подошло или произошла ошибка при парсинге URL, возвращаем offline.html
          return caches.match('./offline.html');
        })
        .catch(() => {
          // Если нет кэша и нет сети, возвращаем базовую страницу
          return caches.match('./offline.html')
            .then(response => {
              if (response) {
                return response;
              }
              // Если даже offline.html не закэширован, создаем простую автономную страницу
              return new Response(
                '<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Оффлайн Todo PWA</title></head><body><h1>Todo (оффлайн)</h1><p>Нет подключения к интернету. Приложение работает в автономном режиме.</p></body></html>',
                { headers: { 'Content-Type': 'text/html' } }
              );
            });
        })
    );
    return;
  }

  // Для остальных запросов используем стратегию cache-first
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // IMPORTANT: Clone the request. A request is a stream and
        // can only be consumed once. Since we are consuming this
        // once by cache and once by the browser for fetch, we need
        // to clone the response.
        var fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          function(response) {
            // Check if we received a valid response
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            var responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        ).catch(error => {
          console.error('Fetch failed for:', event.request.url, error);
          // Возвращаем кэшированный ресурс, если оригинальный запрос не удался
          // Проверяем, есть ли кэшированный fallback для этого типа запроса
          const requestUrl = event.request.url;
          if (requestUrl.includes('.css')) {
            return caches.match('./styles.css');
          } else if (requestUrl.includes('.js')) {
            // Возвращаем базовый JS файл в зависимости от страницы
            if (requestUrl.includes('qr.js')) {
              return caches.match('./qr.js');
            } else if (requestUrl.includes('script.js')) {
              return caches.match('./script.js');
            } else if (requestUrl.includes('jsQR.js')) {
              return caches.match('./jsQR.js');
            } else if (requestUrl.includes('jquery')) {
              return caches.match('./jquery.min.js');
            }
          } else if (requestUrl.includes('icon-')) {
            // Возвращаем одну из доступных иконок
            return caches.match('./icons/icon-192x192.png') || caches.match('./icons/icon-512x512.png');
          }
          
          // Если ничего не нашли, возвращаем offline.html
          return caches.match('./offline.html');
        });
      })
  );
});

// Обработка активации сервис-воркера
self.addEventListener('activate', function(event) {
  console.log('Service Worker activated');
  
  // Удаляем старые кэши
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      ).then(function() {
        // Принудительно устанавливаем этот сервис-воркер как активный
        return self.clients.claim();
      });
    })
  );
});
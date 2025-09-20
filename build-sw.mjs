// scripts/build-sw.mjs
import { generateSW } from 'workbox-build';

// Хелперы-матчеры под твои роуты/домены
const isPublicList = ({url}) =>
    url.pathname === '/api/public-list';

const isApiGet = ({url, request}) =>
    request.method === 'GET' && url.pathname.startsWith('/api/');

const isApiPostThatShouldSync = ({url, request}) =>
    request.method !== 'GET' && (
        url.pathname === '/api/mixes-rate' ||
        url.pathname === '/api/favorites-toggle'
    );

const isStorageImage = ({url, request}) => {
    if (request.destination !== 'image') return false;
    // Supabase public images
    return url.hostname.endsWith('.supabase.co') &&
        url.pathname.includes('/storage/v1/object/public/images/');
};

// Генерим sw.js в dist/
await generateSW({
    globDirectory: 'dist',
    globPatterns: ['**/*.{html,js,css,svg,png,webp,ico,json}'],
    swDest: 'dist/sw.js',
    clientsClaim: true,
    skipWaiting: true,
    cleanupOutdatedCaches: true,

    // Важное для SPA: навигационный фоллбек на index.html
    navigateFallback: '/index.html',
    // игнорим переходы к API и статике — только для SPA роутинга
    navigateFallbackDenylist: [
        new RegExp('^/api/'),         // API не фоллбэчим
        new RegExp('\\.(?:png|jpg|jpeg|webp|avif|svg|gif)$'),
        new RegExp('\\.(?:js|css|json|wasm|map)$'),
    ],

    runtimeCaching: [
        // Публичный листинг: свежесть + быстрый рендер
        {
            urlPattern: isPublicList,
            handler: 'StaleWhileRevalidate',
            options: {
                cacheName: 'api-public-list',
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 5 }, // 5 минут
            },
        },

        // Любые GET-запросы к твоим API (например, деталка микса /api/mix-get)
        {
            urlPattern: isApiGet,
            handler: 'NetworkFirst',
            options: {
                cacheName: 'api-get',
                networkTimeoutSeconds: 3, // быстрее вернём кэш, если сеть тупит
                expiration: { maxEntries: 120, maxAgeSeconds: 60 * 10 },
            },
        },

        // Изображения из Supabase Storage — Cache First со сроком
        {
            urlPattern: isStorageImage,
            handler: 'CacheFirst',
            options: {
                cacheName: 'images-storage',
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 дней
            },
        },

        // Остальные картинки (favicon, локальные и т.п.)
        {
            urlPattern: ({request}) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
                cacheName: 'images-generic',
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
        },

        // POST на рейтинг/избранное — уводим в Background Sync
        {
            urlPattern: isApiPostThatShouldSync,
            handler: 'NetworkOnly',
            options: {
                backgroundSync: {
                    name: 'hh-post-queue',
                    options: {
                        maxRetentionTime: 60 * 24, // 24 часа держим в очереди
                    },
                },
            },
        },
    ],
});

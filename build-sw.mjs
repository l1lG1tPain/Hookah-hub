// Генерирует dist/sw.js: офлайн-оболочка приложения + кэш картинок.
// Данные каталога идут напрямую в Supabase и здесь не кэшируются (всегда свежие).
import { generateSW } from 'workbox-build';

await generateSW({
    globDirectory: 'dist',
    globPatterns: ['**/*.{html,js,css,woff2,png,webp,svg,webmanifest}'],
    globIgnores: ['**/*-{vietnamese,greek,latin-ext}-*.woff2', 'sw.js', 'workbox-*.js', 'push-sw.js'],
    swDest: 'dist/sw.js',
    importScripts: ['/push-sw.js'],
    clientsClaim: true,
    skipWaiting: true,
    cleanupOutdatedCaches: true,
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/m\//, /^\/t\//, /^\/privacy\.html/, /^\/terms\.html/, /^\/api\//, /^\/\.netlify\//],
    runtimeCaching: [
        {
            urlPattern: ({ url, request }) => request.destination === 'image' && url.pathname.includes('/storage/v1/object/public/'),
            handler: 'CacheFirst',
            options: { cacheName: 'hh-images', expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 } },
        },
        {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'hh-images-other', expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 } },
        },
    ],
});

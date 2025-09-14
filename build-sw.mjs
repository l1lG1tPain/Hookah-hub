import { generateSW } from 'workbox-build';

await generateSW({
    globDirectory: 'dist',
    globPatterns: ['**/*.{html,js,css,svg,png,webp,json}'],
    swDest: 'dist/sw.js',
    clientsClaim: true,
    skipWaiting: true,
    runtimeCaching: [
        {
            urlPattern: ({url}) => url.pathname.startsWith('/api/public/'),
            handler: 'StaleWhileRevalidate'
        },
        {
            urlPattern: ({request}) => request.destination === 'image',
            handler: 'CacheFirst',
            options: { cacheName: 'images', expiration: { maxEntries: 200, maxAgeSeconds: 60*60*24*30 } }
        },
        {
            urlPattern: ({url, request}) => request.method !== 'GET' && url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly'
        }
    ]
});

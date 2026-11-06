/* Обработчик пушей; подключается в sw.js через importScripts */
self.addEventListener('push', (e) => {
    let d = {};
    try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
    e.waitUntil(self.registration.showNotification(d.title || 'Hookah Hub', {
        body: d.body || '',
        icon: '/icons/192.png',
        badge: '/icons/192.png',
        tag: d.tag,
        data: { url: d.url || '/' },
    }));
});

self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
    e.waitUntil((async () => {
        const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const c of all) {
            if (new URL(c.url).origin === self.location.origin) { await c.focus(); if ('navigate' in c) return c.navigate(url); return; }
        }
        return clients.openWindow(url);
    })());
});

// main.js
import { startRouter } from './router.js';

function boot() {
    // гарантируем наличие контейнера
    if (!document.getElementById('app')) {
        const app = document.createElement('div');
        app.id = 'app';
        document.body.appendChild(app);
    }

    // нормализуем пустой hash, чтобы сразу был маршрут "/"
    if (!location.hash) {
        location.replace('#/');
    }

    // стартуем роутер (первичный рендер + подписка на hashchange)
    startRouter();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}

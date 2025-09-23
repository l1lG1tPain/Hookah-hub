// src/app/router.js
import { HomePage } from '../pages/home/HomePage.js';
import { FavoritesPage } from '../pages/favorites/FavoritesPage.js';
import { MixView } from '../pages/mix/MixView.js';
import { TobaccoView } from '../pages/tobacco/TobaccoView.js';
import { ProfilePage } from '../pages/profile/ProfilePage.js';

const routes = {
    '/': HomePage,
    '/favorites': FavoritesPage,
    '/mix': MixView,
    '/tobacco': TobaccoView,
    '/profile': ProfilePage,
};

function getPath() {
    const raw = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
    return (raw || '/').split('?')[0];
}

export async function render() {
    const root = document.getElementById('app');
    if (!root) return;
    const path = getPath();
    const View = routes[path] || HomePage;

    // размонтируем предыдущее (если было)
    root.innerHTML = '';

    // рендерим новую страницу
    const node = View();
    root.appendChild(node);
}

// Первичный рендер
export function startRouter() {
    // если пустой hash — ставим главную
    if (!location.hash) {
        // replace чтобы не ломать историю
        location.replace('#/');
    }
    // моментально рендерим
    render();

    // ререндер по изменению hash
    window.addEventListener('hashchange', render);

    // подстраховка, если что-то подключилось позже
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) queueMicrotask(render);
    });
}

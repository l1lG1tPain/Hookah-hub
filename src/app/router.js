// src/app/router.js
import { HomePage } from '../pages/home/HomePage.js';
import { FavoritesPage } from '../pages/favorites/FavoritesPage.js';
import { ProfilePage } from '../pages/profile/ProfilePage.js';
import { MixView } from '../pages/mix/MixView.js';
import { TobaccoView } from '../pages/tobacco/TobaccoView.js';

const routes = {
    '#/': HomePage,
    '#/favorites': FavoritesPage,
    '#/profile': ProfilePage,
    '#/mix': MixView,       // ожидаем #/mix?id=...
    '#/tobacco': TobaccoView // ожидаем #/tobacco?id=...
};

export function navigate(hash){
    const mount = document.getElementById('app');
    const Page = routes[(hash || '').split('?')[0]] || routes['#/'];
    mount.replaceChildren(Page());
}

export function initRouter(){
    window.addEventListener('hashchange', () => navigate(location.hash));
}

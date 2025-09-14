import { HomePage } from '../pages/home/HomePage.js';
import { FavoritesPage } from '../pages/favorites/FavoritesPage.js';
import { ProfilePage } from '../pages/profile/ProfilePage.js';

const routes = {
    '#/': HomePage,
    '#/favorites': FavoritesPage,
    '#/profile': ProfilePage,
};

export function navigate(hash) {
    const mount = document.getElementById('app');
    const Page = routes[hash] || routes['#/'];
    mount.replaceChildren(Page());
}

export function initRouter() {
    window.addEventListener('hashchange', () => navigate(location.hash));
}

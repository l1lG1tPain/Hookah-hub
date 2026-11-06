import '@fontsource-variable/unbounded';
import '@fontsource-variable/manrope';
import './styles/app.css';

import { html, icon, setHTML, esc, avatar } from './lib/ui.js';
import { DEMO } from './lib/supabase.js';
import { initAuth, subscribe, state } from './lib/store.js';
import { installFavHandler, syncFavButtons } from './components.js';
import { applyTheme } from './theme.js';

import { HomePage } from './pages/home.js';
import { TopPage } from './pages/top.js';
import { FavoritesPage } from './pages/favorites.js';
import { ProfilePage } from './pages/profile.js';
import { DetailPage } from './pages/detail.js';
import { CreatePage } from './pages/create.js';
import { AuthorPage } from './pages/author.js';

const routes = {
    '/': HomePage,
    '/top': TopPage,
    '/favorites': FavoritesPage,
    '/profile': ProfilePage,
    '/create': CreatePage,
    '/author': AuthorPage,
    '/mix': (el, p) => DetailPage(el, 'mix', p.get('id')),
    '/tobacco': (el, p) => DetailPage(el, 'tobacco', p.get('id')),
};

const NAV = [
    ['/', 'Главная', 'home'],
    ['/top', 'Топ', 'trophy'],
    ['/favorites', 'Избранное', 'heart'],
    ['/profile', 'Профиль', 'user'],
];

function parse() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = raw.split('?');
    return { path: routes[path] ? path : '/', params: new URLSearchParams(qs || '') };
}

function avatarMini() {
    const u = state.user;
    if (!u) return html`<a class="btn btn--sm btn--accent" href="#/profile">Войти</a>`;
    return html`<a class="avatar-link" href="#/profile" title="${u.name}">${avatar(u, 'avatar--sm')}</a>`;
}

function shell() {
    const app = document.getElementById('app');
    setHTML(app, html`
      <header class="appbar">
        <div class="appbar__in">
          <a class="logo" href="#/"><img src="/icons/192.png" alt=""><span>Hookah<b>Hub</b></span></a>
          <nav class="topnav">${NAV.map(([p, l]) => html`<a href="#${p}" data-nav="${p}">${l}</a>`)}</nav>
          <div class="appbar__user" id="userSlot"></div>
        </div>
      </header>
      ${DEMO ? html`<div class="demo-banner">Демо-режим: данные встроенные, Supabase не подключён</div>` : ''}
      <main id="view" class="view"></main>
      <nav class="tabbar">${NAV.map(([p, l, i]) => html`<a href="#${p}" data-nav="${p}">${icon(i)}<span>${l}</span></a>`)}</nav>
    `);
}

let cleanup = null;
let current = '';
function route() {
    const { path, params } = parse();
    const key = location.hash;
    if (key === current) return;
    current = key;

    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === path));
    document.body.dataset.route = path.slice(1) || 'home';

    try { cleanup?.(); } catch {}
    // свежий контейнер на каждую страницу — без «хвостов» обработчиков от прошлой
    const old = document.getElementById('view');
    const view = document.createElement('main');
    view.id = 'view'; view.className = 'view enter';
    old.replaceWith(view);
    window.scrollTo({ top: 0 });
    cleanup = routes[path](view, params) || null;
}

function paintUser() {
    const slot = document.getElementById('userSlot');
    if (slot) setHTML(slot, state.ready ? avatarMini() : '');
    syncFavButtons();
}

function protectMedia() {
    document.addEventListener('contextmenu', (e) => { if (e.target.closest('img, .cover')) e.preventDefault(); });
    document.addEventListener('dragstart', (e) => { if (e.target.closest('img')) e.preventDefault(); });
}

async function boot() {
    applyTheme();
    protectMedia();
    shell();
    installFavHandler();
    subscribe(paintUser);
    window.addEventListener('hashchange', route);
    route();
    await initAuth();
    // OAuth/PKCE возвращает ?code=… — после обмена чистим адрес
    if (location.search.includes('code=')) history.replaceState(null, '', location.pathname + (location.hash || '#/profile'));
}

boot().catch((e) => {
    console.error(e);
    document.getElementById('app').innerHTML = `<div class="fatal">Что-то пошло не так: ${esc(e.message)}</div>`;
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

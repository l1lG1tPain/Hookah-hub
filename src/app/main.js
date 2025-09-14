import { el } from '../utils/dom.js';

const app = document.getElementById('app');
const root = el('div', { class: 'page home' });
root.innerHTML = `
  <header class="topbar">
    <h1>Hookah Hub</h1>
    <button id="searchBtn">🔎</button>
  </header>
  <nav class="tabs">
    <button class="tab active" data-tab="mixes">Миксы</button>
    <button class="tab" data-tab="tobaccos">Табаки</button>
  </nav>
  <section class="content">
    <div class="chips" id="brandChips"></div>
    <div class="list" id="cardsList">Здесь будут карточки…</div>
  </section>
  <footer class="navbar">
    <a href="#/">Главная</a>
    <a href="#/favorites">Избранное</a>
    <a href="#/profile">Профиль</a>
  </footer>
`;
app.replaceChildren(root);

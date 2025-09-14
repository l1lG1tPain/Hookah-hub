import { el } from '../../utils/dom.js';

export function HomePage(){
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
      <div class="list" id="cardsList">Загрузка…</div>
    </section>
    <footer class="navbar">
      <a href="#/" class="active">Главная</a>
      <a href="#/favorites">Избранное</a>
      <a href="#/profile">Профиль</a>
    </footer>
  `;

    const list = root.querySelector('#cardsList');

    async function load(type='mixes'){
        list.textContent = 'Загрузка…';
        const r = await fetch(`/api/public-list?type=${type}&limit=20`);
        const { ok, items, error } = await r.json();
        if (!ok) { list.textContent = 'Ошибка: ' + error; return; }
        if (!items.length) { list.textContent = 'Пусто'; return; }
        list.innerHTML = items.map(it => `
      <div class="card">
        <div class="title">${(it.title || it.name)}</div>
        ${it.taste_tags ? `<div class="tags">${it.taste_tags.join(', ')}</div>` : ''}
        ${it.is_published === false ? '<span class="badge">Черновик</span>' : ''}
      </div>
    `).join('');
    }

    root.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => {
            root.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b===btn));
            load(btn.dataset.tab);
        });
    });

    load('mixes');
    return root;
}

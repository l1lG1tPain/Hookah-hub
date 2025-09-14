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
        try {
            const r = await fetch(`/api/public-list?type=${type}&limit=20`);
            const { ok, items, error } = await r.json();
            if (!ok) throw new Error(error || 'API error');
            if (!items.length) { list.textContent = 'Пусто'; return; }

            list.innerHTML = items.map(it => `
        <article class="card">
          <div class="card__img">
            <img src="${it.image_url || 'https://placehold.co/600x360?text=Hookah+Hub'}" alt="">
          </div>
          <h3 class="card__title">${it.title || it.name}</h3>
          ${it.taste_tags?.length ? `<div class="card__tags">${it.taste_tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div>` : ''}
        </article>
      `).join('');
        } catch (e) {
            list.textContent = 'Ошибка: ' + e.message;
        }
    }

    root.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => {
            root.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b===btn));
            load(btn.dataset.tab);
        });
    });

    load('mixes'); // дефолт
    return root;
}

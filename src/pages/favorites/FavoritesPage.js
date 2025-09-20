import { getCurrentUser } from '../../app/state.js';

export function FavoritesPage(){
    const div = document.createElement('div');
    div.className = 'page favorites';
    div.innerHTML = `
    <header class="topbar"><h1>Избранное</h1></header>
    <nav class="tabs">
      <button class="tab active" data-tab="mixes">Миксы</button>
      <button class="tab" data-tab="tobaccos">Табаки</button>
    </nav>
    <section class="content"><div id="root">Загрузка…</div></section>
    <footer class="navbar">
      <a href="#/">Главная</a>
      <a href="#/favorites" class="active">Избранное</a>
      <a href="#/profile">Профиль</a>
    </footer>
  `;

    const user = getCurrentUser();
    const root = div.querySelector('#root');
    if (!user) { root.innerHTML = '<p>Войдите, чтобы видеть избранное.</p>'; return div; }

    let current = 'mixes';
    async function load(){
        root.textContent = 'Загрузка…';
        const r = await fetch(`/api/favorites-list?tab=${current}`, { headers: { 'x-tg-id': String(user.tg_id) } });
        const j = await r.json().catch(()=>({}));
        if (!j.ok) { root.textContent = j.error || 'Ошибка'; return; }
        if (!j.items?.length) { root.innerHTML = '<p>Здесь пока пусто.</p>'; return; }
        root.innerHTML = j.items.map(it => `
      <article class="card">
        ${it.cover_url || it.image_url ? `<div class="card__img"><img src="${it.cover_url || it.image_url}" alt=""></div>` : ''}
        <h3 class="card__title">${it.name || it.title}</h3>
        ${(it.tags||it.taste_tags)?.length ? `<div class="card__tags">${(it.tags||it.taste_tags).map(t=>`<span class="tag">${t}</span>`).join('')}</div>`:''}
        <div class="row" style="display:flex; gap:8px; padding:0 12px 12px;">
          <a class="openBtn" href="#/${current==='mixes'?'mix':'tobacco'}?id=${it.id}" style="margin-left:auto">Открыть →</a>
        </div>
      </article>
    `).join('');
    }
    div.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
        div.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        current = b.dataset.tab;
        load();
    }));
    load();
    return div;
}

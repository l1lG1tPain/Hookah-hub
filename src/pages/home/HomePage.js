import { el } from '../../utils/dom.js';
import { getCurrentUser } from '../../app/state.js';

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
      <div style="display:flex; gap:8px; padding:0 0 8px;">
        <input id="q" placeholder="Поиск по названию…" style="flex:1; padding:10px; border-radius:12px; border:1px solid #ddd;">
        <button id="apply">Поиск</button>
      </div>
      <div class="chips" id="tagChips" style="display:flex; gap:8px; overflow:auto; padding-bottom:8px;">
        ${['кислый','сладкий','кислосладкий','табачный','пряный'].map(t => `<button class="chip" data-tag="${t}">${t}</button>`).join('')}
      </div>
      <div class="list" id="cardsList">Загрузка…</div>
    </section>
    <footer class="navbar">
      <a href="#/" class="active">Главная</a>
      <a href="#/favorites">Избранное</a>
      <a href="#/profile">Профиль</a>
    </footer>
  `;

    let currentTab = 'mixes';
    const list = root.querySelector('#cardsList');

    async function load() {
        list.textContent = 'Загрузка…';
        const q = root.querySelector('#q').value.trim();
        const tags = [...root.querySelectorAll('.chip.active')].map(b => b.dataset.tag);
        const url = new URL(`/api/public-list`, location.origin);
        url.searchParams.set('type', currentTab);
        url.searchParams.set('limit', '30');
        if (q) url.searchParams.set('q', q);
        if (tags.length) url.searchParams.set('tags', tags.join(','));

        try {
            const r = await fetch(url.toString());
            const { ok, items, error } = await r.json();
            if (!ok) throw new Error(error || 'API error');
            if (!items.length) { list.textContent = 'Пусто'; return; }

            list.innerHTML = items.map(it => `
        <article class="card" data-id="${it.id}">
          <div class="card__img">
            <img src="${(it.cover_url || it.image_url) || 'https://placehold.co/600x360?text=Hookah+Hub'}" alt="">
          </div>
          <h3 class="card__title">${it.name || it.title || 'Без названия'}</h3>
          ${Array.isArray(it.tags || it.taste_tags) && (it.tags||it.taste_tags).length
                ? `<div class="card__tags">${(it.tags||it.taste_tags).map(t=>`<span class="tag">${t}</span>`).join('')}</div>` : ''}
          <div class="row" style="display:flex; gap:8px; padding:0 12px 12px;">
            ${currentTab==='mixes' ? `
              <button class="rateBtn" data-score="1">😐</button>
              <button class="rateBtn" data-score="2">🙂</button>
              <button class="rateBtn" data-score="3">😎</button>
              <button class="rateBtn" data-score="4">🔥</button>
              <button class="rateBtn" data-score="5">💯</button>
            ` : ''}
            <button class="favBtn" title="В избранное">★</button>
            <a class="openBtn" href="#/${currentTab==='mixes'?'mix':'tobacco'}?id=${it.id}" style="margin-left:auto">Открыть →</a>
          </div>
        </article>
      `).join('');
        } catch (e) {
            list.textContent = 'Ошибка: ' + e.message;
        }
    }

    // переключение вкладок
    root.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => {
            root.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b===btn));
            currentTab = btn.dataset.tab;
            load();
        });
    });

    // поиск
    root.querySelector('#apply').addEventListener('click', load);
    root.querySelector('#q').addEventListener('keydown', e => { if (e.key==='Enter') load(); });

    // чипсы-теги
    root.querySelector('#tagChips').addEventListener('click', e => {
        const chip = e.target.closest('.chip'); if (!chip) return;
        chip.classList.toggle('active');
        load();
    });

    // рейтинги и избранное
    list.addEventListener('click', async (e) => {
        const btn = e.target.closest('button'); if (!btn) return;
        const card = e.target.closest('.card'); if (!card) return;
        const id = card.dataset.id;
        const user = getCurrentUser();

        if (btn.classList.contains('rateBtn')) {
            if (!user) return alert('Войдите для оценки');
            const score = Number(btn.dataset.score);
            await fetch('/api/mixes-rate', {
                method: 'POST',
                headers: { 'content-type':'application/json', 'x-tg-id': String(user.tg_id) },
                body: JSON.stringify({ mix_id: id, score })
            });
        }
        if (btn.classList.contains('favBtn')) {
            if (!user) return alert('Войдите чтобы добавлять в избранное');
            const body = (currentTab==='mixes') ? { mix_id: id } : { tobacco_id: id };
            const r = await fetch('/api/favorites-toggle', {
                method: 'POST',
                headers: { 'content-type':'application/json', 'x-tg-id': String(user.tg_id) },
                body: JSON.stringify(body)
            });
            const { ok, fav } = await r.json().catch(()=>({}));
            if (ok) btn.classList.toggle('active', !!fav);
        }
    });

    load();
    return root;
}

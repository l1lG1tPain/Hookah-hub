// HomePage.js
import { el } from '../../utils/dom.js';
import { getSession, authHeaders } from '../../app/state.js';

// taste chips (можно расширять)
const TASTE_CHIPS = [
    'кислый', 'сладкий', 'кислосладкий', 'табачный', 'пряный',
    'свежий', 'мятный', 'цитрус', 'ягодный', 'фруктовый', 'яблочный', 'ананасовый'
];

export function HomePage(){
    const root = el('div', { class:'page home' });

    root.innerHTML = `
    <header class="topbar">
      <h1>Hookah Hub</h1>
      <button id="searchToggle" class="icon-btn" title="Поиск">🔎</button>
    </header>

    <section class="content">
      <div id="searchRow" class="search-row hidden">
        <input id="q" placeholder="Поиск по названию…" />
        <select id="sort">
          <option value="new">Сначала новые</option>
          <option value="top">Топ</option>
        </select>
      </div>

      <div class="tabs">
        <button class="tab active" data-tab="mixes">Миксы</button>
        <button class="tab" data-tab="tobaccos">Табаки</button>
      </div>

      <div id="chips" class="chips"></div>

      <div id="list" class="grid"></div>
    </section>

    <footer class="navbar">
      <a class="active" href="#/">Главная</a>
      <a href="#/favorites">Избранное</a>
      <a href="#/profile">Профиль</a>
    </footer>
  `;

    // локальные стили (минимум)
    const style = document.createElement('style');
    style.textContent = `
    .icon-btn{ border:none;background:transparent;font-size:20px;padding:8px; }
    .topbar{ display:flex; align-items:center; gap:8px; }
    .topbar h1{ flex:1; text-align:left; }

    .search-row{ display:flex; gap:8px; margin:8px 0 12px; }
    .search-row.hidden{ display:none; }
    #q{ flex:1; padding:12px; border-radius:12px; border:1px solid var(--border); }
    #sort{ padding:12px; border-radius:12px; border:1px solid var(--border); }

    .tabs{ display:flex; gap:8px; margin:4px 0 8px; }
    .tab{ padding:8px 12px; border-radius:999px; border:1px solid var(--border); background:transparent; }
    .tab.active{ background:var(--bg-elevated); font-weight:600; }

    .chips{ display:flex; gap:8px; overflow-x:auto; white-space:nowrap; padding:6px 2px 10px; }
    .chip{ display:inline-block; padding:6px 10px; border-radius:999px; border:1px solid var(--border); cursor:pointer; }
    .chip.active{ background:var(--bg-elevated); }

    .grid{ display:grid; gap:14px; }
    @media (min-width: 880px){ .grid{ grid-template-columns: repeat(2, 1fr); } }
    @media (min-width: 1220px){ .grid{ grid-template-columns: repeat(3, 1fr); } }

    .card{ position:relative; overflow:hidden; border:1px solid var(--border); border-radius:16px; background:var(--bg-elevated); text-decoration:none; color:inherit; display:block; }
    .card__img{ width:100%; aspect-ratio: 16/9; object-fit:cover; background:#ddd; }
    .card__body{ padding:12px; }
    .card__title{ font-weight:700; margin-bottom:6px; }
    .muted{ opacity:.75; }
    .card__tags{ display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
    .tag{ font-size:12px; padding:4px 8px; border-radius:999px; background:var(--chip-bg, #f1f1f1); }

    .fav-btn{
      position:absolute; top:10px; right:10px; width:42px; height:42px; border-radius:999px; border:1px solid var(--border);
      background:rgba(255,255,255,.85); display:flex; align-items:center; justify-content:center;
    }
    .fav-btn span{ font-size:18px; }
    .fav-btn.active{ background:#ffdee4; border-color:#ff99ad; }
  `;
    document.head.appendChild(style);

    const list = root.querySelector('#list');
    const chipsBox = root.querySelector('#chips');
    const q = root.querySelector('#q');
    const sort = root.querySelector('#sort');
    const tabs = root.querySelector('.tabs');
    const searchToggle = root.querySelector('#searchToggle');
    const searchRow = root.querySelector('#searchRow');

    let currentTab = 'mixes';
    let favMixIds = new Set();
    let favTobaccoIds = new Set();
    const activeTags = new Set();

    // chips render
    function renderChips(){
        chipsBox.innerHTML = TASTE_CHIPS
            .map(tag => `<span class="chip ${activeTags.has(tag) ? 'active':''}" data-tag="${tag}">${tag}</span>`)
            .join('');
    }
    renderChips();

    // debounce helper
    function debounce(fn, ms=300){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }

    // abort controller для списка
    let listAbort = null;

    async function loadFavorites(){
        favMixIds.clear(); favTobaccoIds.clear();
        const token = getSession();
        if (!token) return; // не авторизован — тихо выходим
        try{
            const rm = await fetch('/api/favorites-list?tab=mixes', { headers: { ...authHeaders() } });
            const jm = await rm.json(); if (jm?.ok) jm.items.forEach(x => favMixIds.add(x.id));
            const rt = await fetch('/api/favorites-list?tab=tobaccos', { headers: { ...authHeaders() } });
            const jt = await rt.json(); if (jt?.ok) jt.items.forEach(x => favTobaccoIds.add(x.id));
        }catch{/* игнор */}
    }

    function isFav(type, id){ return type==='mix' ? favMixIds.has(id) : favTobaccoIds.has(id); }
    function favSet(type, id, on){ (type==='mix' ? favMixIds : favTobaccoIds)[on?'add':'delete'](id); }

    function cardMix(x){
        const a = document.createElement('a');
        a.href = `#/mix?id=${encodeURIComponent(x.id)}`;
        a.className = 'card';
        a.innerHTML = `
      <img class="card__img" src="${x.cover_url || 'https://placehold.co/1200x675?text=Hookah+Hub'}" alt="" loading="lazy" decoding="async">
      <div class="card__body">
        <div class="card__title">${x.name}</div>
        ${ x.description ? `<div class="muted">${x.description}</div>` : '' }
        ${ x.tags?.length ? `<div class="card__tags">${x.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div>` : '' }
      </div>
      <button class="fav-btn ${isFav('mix', x.id) ? 'active':''}" data-type="mix" data-id="${x.id}" title="В избранное"><span>${isFav('mix', x.id) ? '❤️' : '🤍'}</span></button>
    `;
        return a;
    }

    function cardTobacco(x){
        const a = document.createElement('a');
        a.href = `#/tobacco?id=${encodeURIComponent(x.id)}`;
        a.className = 'card';
        a.innerHTML = `
      <img class="card__img" src="${x.cover_url || 'https://placehold.co/1200x675?text=Hookah+Hub'}" alt="" loading="lazy" decoding="async">
      <div class="card__body">
        <div class="card__title">${x.name}</div>
        <div class="muted">${x.brand_name || ''}</div>
        ${ x.tags?.length ? `<div class="card__tags">${x.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div>` : '' }
      </div>
      <button class="fav-btn ${isFav('tobacco', x.id) ? 'active':''}" data-type="tobacco" data-id="${x.id}" title="В избранное"><span>${isFav('tobacco', x.id) ? '❤️' : '🤍'}</span></button>
    `;
        return a;
    }

    async function loadList(){
        // отменяем предыдущий запрос
        listAbort?.abort();
        listAbort = new AbortController();
        const { signal } = listAbort;

        list.innerHTML = 'Загрузка…';

        const params = new URLSearchParams({
            type: currentTab,
            q: q.value.trim(),
            sort: sort.value
        });
        const tags = [...activeTags];
        if (tags.length) params.set('tags', tags.join(','));

        try {
            const r = await fetch(`/api/public-list?${params.toString()}`, { signal });
            const j = await r.json();
            const items = j?.items || [];

            list.innerHTML = '';
            if (!items.length){
                list.innerHTML = `<div class="muted">Ничего не найдено</div>`;
                return;
            }
            for (const it of items){
                list.appendChild(currentTab === 'mixes' ? cardMix(it) : cardTobacco(it));
            }
        } catch (e) {
            if (e.name === 'AbortError') return;
            list.innerHTML = `<div class="muted">Ошибка загрузки</div>`;
        }
    }

    // события
    chipsBox.addEventListener('click', (e) => {
        const c = e.target.closest('.chip'); if (!c) return;
        const tag = c.dataset.tag;
        if (activeTags.has(tag)) activeTags.delete(tag); else activeTags.add(tag);
        c.classList.toggle('active');
        loadList();
    });

    searchToggle.onclick = () => {
        searchRow.classList.toggle('hidden');
        if (!searchRow.classList.contains('hidden')) q.focus();
    };

    q.addEventListener('input', debounce(loadList, 300));
    sort.addEventListener('change', () => loadList());

    tabs.onclick = (e) => {
        const btn = e.target.closest('.tab'); if (!btn) return;
        tabs.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === btn));
        currentTab = btn.dataset.tab; // 'mixes' | 'tobaccos'
        loadList();
    };

    // делегирование для «сердечек»
    list.addEventListener('click', async (e) => {
        const btn = e.target.closest('.fav-btn'); if (!btn) return;
        e.preventDefault(); e.stopPropagation();

        const token = getSession(); if (!token) return alert('Войдите через Telegram');

        const type = btn.dataset.type, id = btn.dataset.id;
        const was = btn.classList.contains('active');

        // мгновенный отклик
        btn.classList.toggle('active', !was);
        btn.querySelector('span').textContent = !was ? '❤️' : '🤍';
        favSet(type, id, !was);

        try{
            const r = await fetch('/api/favorites-toggle', {
                method: 'POST',
                headers: { 'content-type':'application/json', ...authHeaders() },
                body: JSON.stringify({ item_type: type, item_id: id })
            });
            const j = await r.json();
            if (!j?.ok) throw new Error('fail');
            btn.classList.toggle('active', j.favored);
            btn.querySelector('span').textContent = j.favored ? '❤️' : '🤍';
            favSet(type, id, j.favored);
        }catch{
            // откат
            btn.classList.toggle('active', was);
            btn.querySelector('span').textContent = was ? '❤️' : '🤍';
            favSet(type, id, was);
            alert('Не удалось изменить избранное');
        }
    });

    // первичная загрузка: сразу список (и избранное, если есть сессия)
    (async () => {
        await loadFavorites();
        await loadList();
    })();

    return root;
}

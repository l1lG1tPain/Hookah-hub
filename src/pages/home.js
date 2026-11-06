import { html, icon, setHTML, toNode, debounce, skeletonCards, cover, fmtScore, votesText } from '../lib/ui.js';
import { listMixes, listTobaccos, listBrands } from '../lib/api.js';
import { state as store, subscribe } from '../lib/store.js';
import { card, href, favButton } from '../components.js';
import { TASTES } from '../lib/tastes.js';
import { hasRating } from '../lib/rating.js';
import { openTobaccoSheet } from '../lib/tobaccoForm.js';
import { DEMO } from '../lib/supabase.js';
import { toast } from '../lib/ui.js';
import { makeGreeting } from '../lib/phrases.js';
import { installCard, installMode, dismissed, bindInstall } from '../lib/pwa.js';


const SORTS = [['new', 'Новые'], ['top', 'Лучшие'], ['popular', 'Популярные']];

// фильтры переживают переходы между страницами
const f = { tab: 'mixes', q: '', sort: 'new', tags: new Set(), brands: new Set() };
let brandsCache = null;
let pickCache = null;


export function HomePage(el) {
    const greet = makeGreeting();
    const greeting = () => greet(store.user?.name);
    setHTML(el, html`
      <div id="installSlot"></div>
      <section class="hero">
        <div class="hero__text">
          <p class="eyebrow" id="greet">${greeting()}</p>
          <h1 class="display">Что забьём<br><em>сегодня?</em></h1>
        </div>
        <div class="hero__pick" id="pick"></div>
      </section>

      <section class="cols" id="cols" hidden></section>

      <section class="catalog">
        <div class="toolbar">
          <div class="seg" role="tablist">
            <button role="tab" data-tab="mixes">Миксы</button>
            <button role="tab" data-tab="tobaccos">Табаки</button>
          </div>
          <div class="toolbar__actions">
            <button class="tool-btn ${f.q ? 'on' : ''}" id="searchBtn" aria-label="Поиск" aria-expanded="${!!f.q}">${icon('search')}</button>
            <a class="tool-btn tool-btn--accent" id="plusBtn" href="#/create" aria-label="Создать микс" title="Создать свой микс">${icon('plus')}</a>
          </div>
        </div>
        <div class="searchbar ${f.q ? 'open' : ''}" id="searchBar">
          <label class="search">
            ${icon('search')}
            <input id="q" type="search" placeholder="Микс, табак или бренд" value="${f.q}" autocomplete="off" enterkeyhint="search">
            <button class="search__x" id="qClear" aria-label="Очистить">${icon('x')}</button>
          </label>
        </div>
        <div class="pills" id="sort">${SORTS.map(([k, l]) => html`<button data-sort="${k}">${l}</button>`)}</div>
        <div class="chips" id="brands" hidden></div>
        <div class="chips" id="chips"></div>
        <div class="grid" id="list"></div>
      </section>
    `);

    const $ = (s) => el.querySelector(s);
    const list = $('#list');

    function paintControls() {
        el.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === f.tab));
        const plus = $('#plusBtn'), tob = f.tab === 'tobaccos' && !DEMO;
        plus.title = plus.ariaLabel = tob ? 'Добавить табак или бренд' : 'Создать свой микс';
        plus.setAttribute('href', tob ? '#/' : '#/create');
        el.querySelectorAll('[data-sort]').forEach((b) => b.classList.toggle('on', b.dataset.sort === f.sort));
        setHTML($('#chips'), TASTES.map((t) => html`<button class="chip ${f.tags.has(t) ? 'on' : ''}" data-tag="${t}">${t}</button>`));
        const br = $('#brands');
        br.hidden = f.tab !== 'tobaccos' || !brandsCache?.length;
        if (!br.hidden) setHTML(br, brandsCache.map((b) => html`<button class="chip chip--brand ${f.brands.has(b) ? 'on' : ''}" data-brand="${b}">${b}</button>`));
    }

    /* Подборки: показываем, пока нет фильтров и поиска */
    const COLS = [
        ['🏆 Лучшие по версии сообщества', { sort: 'top', limit: 10 }],
        ['🆕 Новые миксы', { sort: 'new', limit: 10 }],
        ['🍬 Для новичков: сладкие', { sort: 'top', tags: ['сладкий'], limit: 10 }],
        ['🍋 Любителям кислинки', { sort: 'top', tags: ['кислый'], limit: 10 }],
    ];
    let colsData = null;
    async function paintCols() {
        const box = $('#cols');
        const show = f.tab === 'mixes' && !f.q.trim() && !f.tags.size;
        box.hidden = !show;
        if (!show) return;
        colsData ??= await Promise.all(COLS.map(async ([t, o]) => [t, await listMixes(o).catch(() => [])]));
        if (box.hidden) return;
        setHTML(box, colsData.filter(([, items]) => items.length >= 3).map(([t, items]) => html`<div>
            <div class="cols__head"><h2>${t}</h2></div><div class="hscroll">${items.map(card)}</div></div>`));
    }

    let seq = 0;
    async function load() {
        paintCols();
        const my = ++seq;
        list.classList.add('loading');
        if (!list.children.length) setHTML(list, skeletonCards(6));
        try {
            const opts = { q: f.q.trim(), sort: f.sort, tags: [...f.tags], brands: [...f.brands] };
            const items = f.tab === 'mixes' ? await listMixes(opts) : await listTobaccos(opts);
            if (my !== seq) return;
            setHTML(list, items.length ? items.map(card) : html`
              <div class="empty"><img src="/icons/192.png" alt=""><b>Ничего не нашли</b>
              <span>Попробуйте убрать фильтры или изменить запрос</span>
              ${(f.tags.size || f.brands.size || f.q) ? html`<button class="btn" id="reset">Сбросить фильтры</button>` : ''}</div>`);
        } catch (e) {
            console.error(e);
            if (my === seq) setHTML(list, html`<div class="empty"><b>Не удалось загрузить</b><span>Проверьте соединение</span><button class="btn" id="retry">Повторить</button></div>`);
        } finally {
            if (my === seq) list.classList.remove('loading');
        }
    }

    async function loadPick() {
        try {
            pickCache ??= (await listMixes({ sort: 'top', limit: 10 })).filter(hasRating);
            if (!pickCache.length) return;
            const day = Math.floor(Date.now() / 864e5);
            const m = pickCache[day % pickCache.length];
            setHTML($('#pick'), html`<a class="pick" href="${href(m)}">
                ${cover(m, 'pick__cover')}
                <div class="pick__shade"></div>
                <span class="pick__label">Микс дня</span>
                ${favButton('mix', m.id, 'pick__fav')}
                <div class="pick__body">
                  <div class="pick__title">${m.name}</div>
                  <div class="pick__meta"><span class="pick__score">${icon('flame')} ${fmtScore(m.avg_score)}</span> · ${votesText(m.votes)}</div>
                  <div class="pick__tags">${m.tags.slice(0, 3).join(' · ')}</div>
                </div>
              </a>`);
        } catch { /* не критично */ }
    }

    el.addEventListener('click', (e) => {
        const t = e.target.closest('[data-tab],[data-sort],[data-tag],[data-brand],#reset,#retry');
        if (!t) return;
        if (t.dataset.tab) {
            if (f.tab === t.dataset.tab) return;
            f.tab = t.dataset.tab; f.brands.clear(); list.innerHTML = '';
            if (f.tab === 'tobaccos' && !brandsCache) listBrands().then((b) => { brandsCache = b; paintControls(); });
        } else if (t.dataset.sort) f.sort = t.dataset.sort;
        else if (t.dataset.tag) f.tags.has(t.dataset.tag) ? f.tags.delete(t.dataset.tag) : f.tags.add(t.dataset.tag);
        else if (t.dataset.brand) f.brands.has(t.dataset.brand) ? f.brands.delete(t.dataset.brand) : f.brands.add(t.dataset.brand);
        else if (t.id === 'reset') { f.tags.clear(); f.brands.clear(); f.q = ''; $('#q').value = ''; $('#searchBtn').classList.remove('on'); }
        paintControls();
        load();
    });

    $('#plusBtn').addEventListener('click', (e) => {
        if (f.tab !== 'tobaccos' || DEMO) return;
        e.preventDefault();
        if (!store.user) { toast('Войдите, чтобы добавлять табаки'); location.hash = '#/profile'; return; }
        openTobaccoSheet({ onCreated: (t) => { location.hash = `#/tobacco?id=${encodeURIComponent(t.id)}`; } });
    });
    $('#q').addEventListener('input', debounce((e) => { f.q = e.target.value; $('#searchBtn').classList.toggle('on', !!f.q); load(); }, 280));
    $('#searchBtn').addEventListener('click', () => {
        const bar = $('#searchBar');
        const open = !bar.classList.contains('open');
        bar.classList.toggle('open', open);
        $('#searchBtn').setAttribute('aria-expanded', open);
        if (open) setTimeout(() => $('#q').focus(), 60);
        else if (f.q) { f.q = ''; $('#q').value = ''; $('#searchBtn').classList.remove('on'); load(); }
    });
    $('#qClear').addEventListener('click', (e) => {
        e.preventDefault();
        if (f.q) { f.q = ''; $('#q').value = ''; $('#searchBtn').classList.remove('on'); load(); }
        $('#q').focus();
    });

    if (f.tab === 'tobaccos' && !brandsCache) listBrands().then((b) => { brandsCache = b; paintControls(); });
    paintControls();
    load();
    loadPick();

    const paintInstall = () => {
        const on = installMode() && !dismissed();
        setHTML($('#installSlot'), on ? installCard({ compact: true }) : '');
    };
    paintInstall();
    const offInstall = bindInstall(el, paintInstall);

    // имя в приветствии появится после входа
    const off = subscribe(() => { const g = el.querySelector('#greet'); if (g) g.textContent = greeting(); });
    return () => { off(); offInstall(); };
}

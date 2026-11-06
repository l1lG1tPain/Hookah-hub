import { html, setHTML, skeletonCards } from '../lib/ui.js';
import { getItemsByIds } from '../lib/api.js';
import { state, subscribe } from '../lib/store.js';
import { card } from '../components.js';

let tab = 'mix';

export function FavoritesPage(el) {
    setHTML(el, html`
      <section class="page-head">
        <p class="eyebrow">Ваша коллекция</p>
        <h1 class="display display--sm">Избранное</h1>
        <div class="seg" role="tablist" id="seg"></div>
      </section>
      <div class="grid" id="list"></div>
    `);
    const list = el.querySelector('#list');
    const seg = el.querySelector('#seg');
    let shownKey = '';

    const ids = (t) => [...state.favs].filter((k) => k.startsWith(t + ':')).map((k) => k.slice(t.length + 1));

    async function paint() {
        if (!state.ready) { setHTML(list, skeletonCards(3)); return; }
        if (!state.user) {
            seg.hidden = true;
            setHTML(list, html`<div class="empty empty--wide"><img src="/icons/192.png" alt="">
              <b>Сохраняйте любимые миксы</b><span>Войдите — и избранное будет с вами на любом устройстве</span>
              <a class="btn btn--accent" href="#/profile">Войти</a></div>`);
            return;
        }
        seg.hidden = false;
        const m = ids('mix'), t = ids('tobacco');
        setHTML(seg, html`
          <button role="tab" data-tab="mix" aria-selected="${tab === 'mix'}">Миксы <span class="count">${m.length}</span></button>
          <button role="tab" data-tab="tobacco" aria-selected="${tab === 'tobacco'}">Табаки <span class="count">${t.length}</span></button>`);

        const cur = tab === 'mix' ? m : t;
        const k = tab + cur.join(',');
        if (k === shownKey) return;
        shownKey = k;
        if (!cur.length) {
            setHTML(list, html`<div class="empty empty--wide"><img src="/icons/192.png" alt="">
              <b>Здесь пока пусто</b><span>Нажмите ♥ на карточке ${tab === 'mix' ? 'микса' : 'табака'}, чтобы сохранить его</span>
              <a class="btn" href="#/">Перейти в каталог</a></div>`);
            return;
        }
        if (!list.querySelector('.card')) setHTML(list, skeletonCards(Math.min(cur.length, 6)));
        try {
            const items = await getItemsByIds(tab, cur);
            if (shownKey === k) setHTML(list, items.map(card));
        } catch {
            setHTML(list, html`<div class="empty"><b>Не удалось загрузить</b></div>`);
        }
    }

    seg.addEventListener('click', (e) => {
        const b = e.target.closest('[data-tab]');
        if (b && b.dataset.tab !== tab) { tab = b.dataset.tab; shownKey = ''; list.innerHTML = ''; paint(); }
    });

    paint();
    return subscribe(paint);
}

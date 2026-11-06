import { html, setHTML } from '../lib/ui.js';
import { listMixes, listTobaccos } from '../lib/api.js';
import { rowItem } from '../components.js';
import { rankItems, MIN_VOTES } from '../lib/rating.js';

let tab = 'mixes';

export function TopPage(el) {
    setHTML(el, html`
      <section class="page-head">
        <p class="eyebrow">Рейтинг сообщества</p>
        <h1 class="display display--sm">Топ <em>Hookah Hub</em></h1>
        <p class="lead">Учитываем и среднюю оценку, и число голосов — так случайные «пятёрки» не перебивают проверенную классику. В рейтинг попадают позиции с ${MIN_VOTES}+ оценками.</p>
        <div class="seg" role="tablist">
          <button role="tab" data-tab="mixes">Миксы</button>
          <button role="tab" data-tab="tobaccos">Табаки</button>
        </div>
      </section>
      <div class="rows rows--top" id="list"></div>
    `);
    const list = el.querySelector('#list');

    async function load() {
        el.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === tab));
        setHTML(list, Array.from({ length: 6 }, () => html`<div class="row row--skel"><div class="skel"></div></div>`));
        try {
            const items = tab === 'mixes'
                ? await listMixes({ sort: 'popular', limit: 100 })
                : await listTobaccos({ sort: 'popular', limit: 100 });
            const top = rankItems(items).slice(0, 50);
            setHTML(list, top.length ? top.map((x, i) => rowItem(x, { rank: i + 1 }))
                : html`<div class="empty"><b>Пока пусто</b><span>Оценок ещё недостаточно для рейтинга</span></div>`);
        } catch {
            setHTML(list, html`<div class="empty"><b>Не удалось загрузить</b></div>`);
        }
    }

    el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-tab]');
        if (b && b.dataset.tab !== tab) { tab = b.dataset.tab; load(); }
    });
    load();
}

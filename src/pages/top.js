import { html, setHTML } from '../lib/ui.js';
import { listMixes, listTobaccos } from '../lib/api.js';
import { rowItem } from '../components.js';

let tab = 'mixes';

/** Взвешенный рейтинг (как в IMDb Top): микс с 2 оценками «5.0» не обгонит микс с 80 оценками «4.8» */
function ranked(items) {
    const rated = items.filter((x) => x.votes && x.avg_score != null);
    if (!rated.length) return [];
    const C = rated.reduce((s, x) => s + x.avg_score * x.votes, 0) / rated.reduce((s, x) => s + x.votes, 0);
    const m = 5;
    return rated
        .map((x) => ({ ...x, wr: (x.votes / (x.votes + m)) * x.avg_score + (m / (x.votes + m)) * C }))
        .sort((a, b) => b.wr - a.wr);
}

export function TopPage(el) {
    setHTML(el, html`
      <section class="page-head">
        <p class="eyebrow">Рейтинг сообщества</p>
        <h1 class="display display--sm">Топ <em>Hookah Hub</em></h1>
        <p class="lead">Учитываем и среднюю оценку, и число голосов — так случайные «пятёрки» не перебивают проверенную классику.</p>
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
            const top = ranked(items).slice(0, 50);
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

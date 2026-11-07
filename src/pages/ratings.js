import { html, setHTML, icon, SCORES } from '../lib/ui.js';
import { getItemsByIds } from '../lib/api.js';
import { state } from '../lib/store.js';
import { rowItem } from '../components.js';

export async function loadRatingRows(box, limit = Infinity) {
    const entries = [...state.ratings.entries()].map(([k, score]) => { const i = k.indexOf(':'); return { type: k.slice(0, i), id: k.slice(i + 1), score }; });
    if (!entries.length) {
        setHTML(box, html`<div class="empty"><b>Вы ещё ничего не оценили</b><span>Откройте любой микс и поставьте оценку</span><a class="btn" href="#/">В каталог</a></div>`);
        return 0;
    }
    try {
        const [mixes, tobs] = await Promise.all([
            getItemsByIds('mix', entries.filter((e) => e.type === 'mix').map((e) => e.id)),
            getItemsByIds('tobacco', entries.filter((e) => e.type === 'tobacco').map((e) => e.id)),
        ]);
        const all = [...mixes, ...tobs].map((x) => ({ x, s: state.ratings.get(`${x.type}:${x.id}`) })).sort((a, b) => b.s - a.s);
        setHTML(box, all.slice(0, limit).map(({ x, s }) => {
            const sc = SCORES.find((q) => q.n === s);
            return rowItem(x, { right: html`<span class="mine" title="Ваша оценка">${sc?.emoji}<small>${sc?.label}</small></span>` });
        }));
        return all.length;
    } catch {
        setHTML(box, html`<div class="empty"><b>Не удалось загрузить</b></div>`);
        return 0;
    }
}

export function RatingsPage(el) {
    const back = () => (history.length > 1 ? history.back() : (location.hash = '#/profile'));
    setHTML(el, html`
      <section class="page-head">
        <button class="btn btn--sm" id="back">${icon('back')} Назад</button>
        <h1 class="display display--sm">Мои оценки</h1>
      </section>
      <div class="rows" id="list"><div class="row row--skel"><div class="skel"></div></div></div>
    `);
    el.querySelector('#back').onclick = back;
    loadRatingRows(el.querySelector('#list'));
}

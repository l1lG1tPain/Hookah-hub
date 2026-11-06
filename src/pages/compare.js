import { html, icon, setHTML, sheet, debounce, fmtScore, votesText } from '../lib/ui.js';
import { getMix, listMixes } from '../lib/api.js';
import { hasRating } from '../lib/rating.js';
import { href } from '../components.js';

const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];

/** Шторка выбора микса для сравнения */
export function pickMix(onPick, excludeId) {
    const s = sheet(html`<div class="picker"><h2 class="h2">С каким миксом сравнить?</h2>
        <label class="search search--sm">${icon('search')}<input id="mq" type="search" placeholder="Название микса" autocomplete="off"></label>
        <div class="picker__list" id="ml"></div></div>`);
    const input = s.body.querySelector('#mq'), list = s.body.querySelector('#ml');
    let seq = 0;
    const load = async () => {
        const my = ++seq;
        try {
            const items = (await listMixes({ q: input.value.trim(), sort: input.value.trim() ? 'popular' : 'top', limit: 30 })).filter((m) => m.id !== excludeId);
            if (my !== seq) return;
            setHTML(list, items.length ? items.map((m) => html`<button type="button" class="picker__item" data-id="${m.id}">${m.name}${hasRating(m) ? html` <small>★ ${fmtScore(m.avg_score)}</small>` : ''}</button>`)
                : html`<div class="muted small">Ничего не нашли</div>`);
        } catch { setHTML(list, html`<div class="muted small">Не удалось загрузить</div>`); }
    };
    list.addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) { onPick(b.dataset.id); s.close(); } });
    input.addEventListener('input', debounce(load, 200));
    load();
    setTimeout(() => input.focus(), 80);
}

export function ComparePage(el, params) {
    const a = params.get('a'), b = params.get('b');
    setHTML(el, html`<section class="page-head"><p class="eyebrow">Сравнение</p><h1 class="display display--sm">Два микса <em>рядом</em></h1></section><div id="cmp"><div class="panel skel" style="height:260px"></div></div>`);
    const box = el.querySelector('#cmp');
    const go = (x, y) => { location.hash = `#/compare?a=${encodeURIComponent(x)}${y ? `&b=${encodeURIComponent(y)}` : ''}`; };

    (async () => {
        if (!a) { setHTML(box, html`<div class="empty"><b>Выберите первый микс</b><button class="btn btn--accent" id="p1">Выбрать</button></div>`); box.querySelector('#p1').onclick = () => pickMix((id) => go(id)); return; }
        const [ma, mb] = await Promise.all([getMix(a), b ? getMix(b) : null]).catch(() => [null, null]);
        if (!ma) { setHTML(box, html`<div class="empty"><b>Микс не найден</b><a class="btn" href="#/">В каталог</a></div>`); return; }

        const shared = new Set(mb ? (ma.ingredients || []).map((i) => i.tobacco).filter((t) => (mb.ingredients || []).some((j) => j.tobacco === t)) : []);
        const tagsB = new Set(mb?.tags || []);
        const col = (m, other) => !m ? html`<div class="cmp__col cmp__col--empty"><button class="btn btn--accent" id="pick2">${icon('plus')} Выбрать второй микс</button></div>` : html`
          <div class="cmp__col">
            <a class="cmp__title" href="${href(m)}">${m.name}</a>
            <div class="cmp__score">${hasRating(m) ? html`${icon('flame')}<b>${fmtScore(m.avg_score)}</b><small>${votesText(m.votes)}</small>` : html`<small>Мало оценок</small>`}</div>
            <div class="card__tags">${(m.tags || []).map((t) => html`<span class="tag ${other && (other.tags || []).includes(t) ? 'tag--common' : ''}">${t}</span>`)}</div>
            <div class="stack">${(m.ingredients || []).map((x, i) => html`<i style="flex:${x.percent};background:${COLORS[i % 6]}"></i>`)}</div>
            <ul class="ing ing--sm">${(m.ingredients || []).map((x, i) => html`<li class="${shared.has(x.tobacco) ? 'ing--shared' : ''}">
              <span class="ing__dot" style="background:${COLORS[i % 6]}"></span>
              <span class="ing__name"><b>${x.tobacco}</b>${x.brand ? html`<small>${x.brand}</small>` : ''}</span><span class="ing__pct">${x.percent}%</span></li>`)}</ul>
          </div>`;
        setHTML(box, html`<div class="cmp">${col(ma, mb)}${col(mb, ma)}</div>
          ${mb ? html`<p class="hint">${shared.size ? `Общие табаки подсвечены: ${[...shared].join(', ')}.` : 'Общих табаков нет.'}
            ${[...tagsB].some((t) => (ma.tags || []).includes(t)) ? 'Общие вкусы выделены.' : ''}</p>
            <div class="create__row-actions"><button class="btn btn--sm" id="swap">⇄ Поменять местами</button><button class="btn btn--sm btn--ghost" id="pick2">Другой микс</button></div>` : ''}`);
        box.querySelector('#pick2')?.addEventListener('click', () => pickMix((id) => go(a, id), a));
        box.querySelector('#swap')?.addEventListener('click', () => go(b, a));
    })();
}

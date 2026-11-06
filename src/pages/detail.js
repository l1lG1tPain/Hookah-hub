import { html, icon, setHTML, cover, fmtScore, votesText, SCORES, toast, shareLink, scoreTone, avatar, sheet } from '../lib/ui.js';
import { getMix, getTobacco, mixesWithTobacco, getAuthor, deleteMix } from '../lib/api.js';
import { state, myScore, setRating, subscribe, refreshUser } from '../lib/store.js';
import { favButton, distribution, card, scoreBadge } from '../components.js';

const SEG_COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];

export function DetailPage(el, type, id) {
    let item = null;
    setHTML(el, html`<div class="detail detail--loading"><div class="detail__hero skel"></div>
      <div class="detail__wrap"><div class="skel skel--title"></div><div class="skel skel--line"></div></div></div>`);

    const back = () => (history.length > 1 ? history.back() : (location.hash = '#/'));

    function yourRating() {
        const mine = myScore(type, id);
        if (!state.user) {
            return html`<div class="rate rate--guest"><span>Пробовали? Оцените — это займёт секунду.</span>
              <a class="btn btn--accent btn--sm" href="#/profile">Войти и оценить</a></div>`;
        }
        return html`<div class="rate">
          <div class="rate__head"><b>${mine ? 'Ваша оценка' : 'Как вам?'}</b><span class="muted">${mine ? 'можно изменить' : 'хуже → лучше'}</span></div>
          <div class="rate__opts">${[...SCORES].reverse().map(({ n, label, emoji }) =>
              html`<button class="rate__opt ${mine === n ? 'on' : ''}" data-score="${n}"><span class="rate__emoji">${emoji}</span><span>${label}</span></button>`)}</div>
        </div>`;
    }

    function composition(ing) {
        if (!ing?.length) return '';
        const total = ing.reduce((s, x) => s + x.percent, 0) || 100;
        return html`<section class="block">
          <h2 class="h2">Состав</h2>
          <div class="stack">${ing.map((x, i) => html`<i style="flex:${x.percent / total};background:${SEG_COLORS[i % 6]}" title="${x.tobacco} ${x.percent}%"></i>`)}</div>
          <ul class="ing">${ing.map((x, i) => html`<li>
              <span class="ing__dot" style="background:${SEG_COLORS[i % 6]}"></span>
              <span class="ing__name"><b>${x.tobacco}</b>${x.brand ? html`<small>${x.brand}</small>` : ''}</span>
              <span class="ing__pct">${x.percent}%</span></li>`)}</ul>
          <p class="hint">${icon('flame')} Забейте сами или покажите этот экран кальянщику. После дегустации не забудьте оценить.</p>
        </section>`;
    }

    function paint() {
        const x = item;
        setHTML(el, html`<article class="detail">
          <div class="detail__hero">
            ${cover(x, 'detail__cover')}
            <div class="detail__shade"></div>
            <div class="detail__bar">
              <button class="icon-btn icon-btn--glass" id="back" aria-label="Назад">${icon('back')}</button>
              <span class="spacer"></span>
              <button class="icon-btn icon-btn--glass" id="share" aria-label="Поделиться">${icon('share')}</button>
              ${favButton(type, id, 'fav--glass')}
            </div>
          </div>

          <div class="detail__wrap">
            <header class="detail__head">
              <p class="eyebrow">${type === 'mix' ? 'Микс' : html`Табак${x.brand_name ? html` · <b>${x.brand_name}</b>${x.line_name ? ` · ${x.line_name}` : ''}` : ''}`}</p>
              <h1 class="display display--sm">${x.name}</h1>
              ${x.tags?.length ? html`<div class="card__tags">${x.tags.map((t) => html`<span class="tag">${t}</span>`)}</div>` : ''}
              ${type === 'mix' ? html`<div id="author" class="author-slot"></div>` : ''}
              <button class="detail__quick" data-jump>${scoreBadge(x)} ${x.votes ? votesText(x.votes) : 'Нет оценок'}${myScore(type, id) ? html` · ваша: ${SCORES.find((q) => q.n === myScore(type, id)).emoji}` : ''}</button>
            </header>

            <div class="detail__grid">
              <div class="detail__main">
                ${type === 'mix' ? composition(x.ingredients) : ''}
                ${x.description ? html`<section class="block"><h2 class="h2">Описание</h2><p class="prose">${x.description}</p></section>` : ''}
                <div id="related"></div>
              </div>

              <aside class="detail__side" id="rate-anchor">
                <section class="panel scorebox">
                  ${x.votes ? html`<div class="scorebox__big score--${scoreTone(x.avg_score)}">
                    ${icon('flame')}<b>${fmtScore(x.avg_score)}</b><small>/ 5</small>
                  </div>` : html`<div class="scorebox__none">${icon('flame')} Пока без оценок</div>`}
                  <div class="scorebox__votes">${x.votes ? votesText(x.votes) : 'Попробуйте и станьте первым, кто оценит'}</div>
                  ${x.votes ? distribution(x.dist, x.votes) : ''}
                </section>
                <section class="panel" id="rate">${yourRating()}</section>
              </aside>
            </div>
          </div>
        </article>`);

        el.querySelector('#back').onclick = back;
        el.querySelector('#share').onclick = () => {
            const lines = [`${type === 'mix' ? 'Микс' : 'Табак'} «${x.name}» на Hookah Hub`];
            if (x.brand_name) lines.push(`Бренд: ${x.brand_name}`);
            if (x.ingredients?.length) lines.push(...x.ingredients.map((i) => `• ${i.brand ? i.brand + ' ' : ''}${i.tobacco} — ${i.percent}%`));
            if (x.votes) lines.push(`Оценка: ${fmtScore(x.avg_score)}/5 (${votesText(x.votes)})`);
            shareLink({ title: x.name, text: lines.join('\n'), url: location.href });
        };
        if (type === 'tobacco') loadRelated();
        if (type === 'mix') loadAuthor();
    }

    async function loadAuthor() {
        const box = el.querySelector('#author');
        if (!box) return;
        const a = item.author_id ? await getAuthor(item.author_id).catch(() => null) : null;
        const mine = state.user && item.author_id && state.user.id === item.author_id;
        setHTML(box, html`
          ${a ? html`<a class="author-chip" href="#/author?id=${a.id}">${avatar(a, 'avatar--xs')}<span>Автор: <b>${a.name}</b></span>${icon('chevron')}</a>`
              : html`<span class="author-chip author-chip--static">${avatar({ name: 'Hookah Hub' }, 'avatar--xs')}<span>Автор: <b>Hookah Hub</b></span></span>`}
          ${mine ? html`<button class="btn btn--sm btn--ghost danger" id="delMix">${icon('trash')} Удалить</button>` : ''}`);
        box.querySelector('#delMix')?.addEventListener('click', confirmDelete);
    }

    function confirmDelete() {
        const s = sheet(html`<div class="confirm">
            <h2 class="h2">Удалить микс?</h2>
            <p class="muted">«${item.name}» пропадёт из каталога вместе с оценками. Это нельзя отменить.</p>
            <div class="confirm__btns">
              <button class="btn btn--lg" data-close>Отмена</button>
              <button class="btn btn--lg btn--danger" id="yes">Удалить</button>
            </div></div>`);
        s.body.querySelector('#yes').onclick = async () => {
            try { await deleteMix(item.id); s.close(); toast('Микс удалён'); refreshUser(); location.hash = '#/profile'; }
            catch (e) { toast(e.message || 'Не удалось удалить', 'err'); }
        };
    }

    async function loadRelated() {
        const mixes = await mixesWithTobacco(item.name, item.brand_name).catch(() => []);
        const box = el.querySelector('#related');
        if (box && mixes.length) {
            setHTML(box, html`<section class="block"><h2 class="h2">Миксы с этим табаком</h2>
              <div class="grid grid--compact">${mixes.slice(0, 6).map(card)}</div></section>`);
        }
    }

    async function load() {
        try {
            item = type === 'mix' ? await getMix(id) : await getTobacco(id);
        } catch (e) { console.error(e); item = undefined; }
        if (!item) {
            setHTML(el, html`<div class="empty empty--page"><img src="/icons/192.png" alt="">
              <b>${item === null ? 'Не нашли такую позицию' : 'Не удалось загрузить'}</b>
              <a class="btn" href="#/">На главную</a></div>`);
            return;
        }
        document.title = `${item.name} — Hookah Hub`;
        paint();
    }

    el.addEventListener('click', async (e) => {
        if (e.target.closest('[data-jump]')) { el.querySelector('#rate-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
        const b = e.target.closest('[data-score]');
        if (!b) return;
        const n = Number(b.dataset.score);
        try {
            await setRating(type, id, n);
            toast(`Оценка «${SCORES.find((s) => s.n === n).label}» сохранена`);
            const fresh = type === 'mix' ? await getMix(id) : await getTobacco(id);
            if (fresh) { item = fresh; paint(); }
        } catch {
            toast('Не удалось сохранить оценку', 'err');
        }
    });

    const unsub = subscribe(() => {
        const box = el.querySelector('#rate');
        if (box) setHTML(box, yourRating());
    });

    load();
    return () => { unsub(); document.title = 'Hookah Hub'; };
}

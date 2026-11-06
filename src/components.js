// Общие компоненты: карточки, бейдж рейтинга, сердечко, распределение оценок
import { html, icon, cover, fmtScore, scoreTone, SCORES, votesText, toast } from './lib/ui.js';
import { state, isFav, toggleFav } from './lib/store.js';
import { hasRating, votesLeft } from './lib/rating.js';

export const href = (item) => `#/${item.type}?id=${encodeURIComponent(item.id)}`;

export function scoreBadge(item, cls = '') {
    if (!hasRating(item)) return html`<span class="score score--new ${cls}" title="${item.votes ? `Нужно ещё ${votesLeft(item)} оц. для рейтинга` : 'Ещё не оценивали'}">new</span>`;
    return html`<span class="score score--${scoreTone(item.avg_score)} ${cls}" title="${votesText(item.votes)}">${icon('flame')}<b>${fmtScore(item.avg_score)}</b></span>`;
}

export function favButton(type, id, cls = '') {
    const on = isFav(type, id);
    return html`<button class="fav ${on ? 'on' : ''} ${cls}" data-fav="${type}:${id}" aria-pressed="${on}" aria-label="В избранное">${icon('heart')}</button>`;
}

export function card(item) {
    const sub = item.type === 'tobacco' ? item.brand_name : item.description;
    return html`<a class="card" href="${href(item)}">
      ${cover(item)}
      <div class="card__top">${scoreBadge(item)}${favButton(item.type, item.id)}</div>
      <div class="card__body">
        <div class="card__title">${item.name}</div>
        ${sub ? html`<div class="card__sub">${sub}</div>` : ''}
        ${item.tags?.length ? html`<div class="card__tags">${item.tags.slice(0, 3).map((t) => html`<span class="tag">${t}</span>`)}</div>` : ''}
        <div class="card__meta">${item.votes ? votesText(item.votes) : 'Ещё не оценивали'}</div>
      </div>
    </a>`;
}

export function rowItem(item, { rank, right } = {}) {
    return html`<a class="row" href="${href(item)}">
      ${rank != null ? html`<span class="row__rank">${rank}</span>` : ''}
      ${cover(item, 'row__cover')}
      <div class="row__main">
        <div class="row__title">${item.name}</div>
        <div class="row__sub">${item.type === 'tobacco' ? item.brand_name : (item.tags || []).slice(0, 3).join(' · ')}</div>
        <div class="row__meta">${item.votes ? votesText(item.votes) : 'нет оценок'}</div>
      </div>
      ${right ?? scoreBadge(item, 'score--lg')}
    </a>`;
}

export function distribution(dist, votes) {
    const total = votes || Object.values(dist || {}).reduce((a, b) => a + b, 0);
    return html`<div class="dist">${SCORES.map(({ n, label, emoji }) => {
        const v = dist?.[n] || 0;
        const p = total ? Math.round((v / total) * 100) : 0;
        return html`<div class="dist__row"><span class="dist__label">${emoji} ${label}</span>
          <span class="dist__bar"><i style="width:${p}%"></i></span><span class="dist__val">${p}%</span></div>`;
    })}</div>`;
}

/* Всплеск сердечек + лёгкая вибрация */
function burst(btn) {
    try { navigator.vibrate?.(12); } catch {}
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = btn.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (let i = 0; i < 7; i++) {
        const h = document.createElement('span');
        const a = (Math.PI * 2 * i) / 7 + Math.random() * 0.6, d = 28 + Math.random() * 26;
        h.className = 'heartfly'; h.textContent = ['❤️', '🔥', '💖'][i % 3];
        h.style.cssText = `left:${cx - 8}px;top:${cy - 8}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 18}px`;
        document.body.appendChild(h);
        setTimeout(() => h.remove(), 850);
    }
}

/* Глобально: клики по сердечкам и синхронизация их состояния */
export function installFavHandler() {
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-fav]');
        if (!btn) return;
        e.preventDefault(); e.stopPropagation();
        if (!state.user) {
            toast('Войдите, чтобы сохранять в избранное');
            location.hash = '#/profile';
            return;
        }
        const [type, id] = btn.dataset.fav.split(':');
        btn.classList.add('pop');
        setTimeout(() => btn.classList.remove('pop'), 500);
        try {
            const on = await toggleFav(type, id);
            if (on) burst(btn);
            toast(on ? 'Добавлено в избранное' : 'Убрано из избранного');
        } catch {
            toast('Не удалось обновить избранное', 'err');
        }
    });
}

export function syncFavButtons(root = document) {
    root.querySelectorAll('[data-fav]').forEach((b) => {
        const [type, id] = b.dataset.fav.split(':');
        const on = isFav(type, id);
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on);
    });
}

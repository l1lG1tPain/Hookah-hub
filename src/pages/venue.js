import { html, icon, setHTML, skeletonCards, plural } from '../lib/ui.js';
import { getVenue, myVenues } from '../lib/api.js';
import { venueShareSheet } from '../lib/venueShare.js';
import { state } from '../lib/store.js';
import { card } from '../components.js';

export function VenuePage(el, params) {
    const slug = params.get('s');
    setHTML(el, html`<div class="author">
        <section class="author__head" id="head"><div class="panel skel" style="height:120px;width:100%"></div></section>
        <div class="grid" id="list">${skeletonCards(3)}</div>
      </div>`);

    (async () => {
        try {
            const v = slug ? await getVenue(slug) : null;
            if (!v) {
                setHTML(el, html`<div class="empty empty--page"><b>Заведение не найдено</b><a class="btn" href="#/">На главную</a></div>`);
                return;
            }
            document.title = `${v.name} — Hookah Hub`;
            const mine = state.user ? (await myVenues().catch(() => [])).some((x) => x.id === v.id) : false;
            const n = v.mixes.length;
            setHTML(el.querySelector('#head'), html`
              ${v.logo_url ? html`<img class="avatar avatar--xl" src="${v.logo_url}" alt="">` : html`<span class="avatar avatar--xl">${v.name.slice(0, 1).toUpperCase()}</span>`}
              <div class="author__info">
                <p class="eyebrow">Заведение${v.verified ? ' · проверено' : ''}</p>
                <h1 class="display display--sm">${v.name}</h1>
                ${v.city ? html`<p class="author__handle">${v.city}</p>` : ''}
                ${v.description ? html`<p class="author__bio">${v.description}</p>` : ''}
                <p class="muted">${n} ${plural(n, 'микс', 'микса', 'миксов')} в меню</p>
              </div>
              <div class="author__actions">
                <button class="btn btn--accent" id="shareVenue">${icon('qr')} QR и ссылка</button>
                ${mine ? html`<a class="btn" href="#/profile">Управлять</a>` : ''}
              </div>`);
            el.querySelector('#shareVenue').onclick = () => venueShareSheet(v);
            setHTML(el.querySelector('#list'), n ? v.mixes.map(card) : html`<div class="empty"><b>Меню пока пустое</b></div>`);
        } catch (e) {
            console.error(e);
            setHTML(el.querySelector('#list'), html`<div class="empty"><b>Не удалось загрузить</b></div>`);
        }
    })();
    return () => { document.title = 'Hookah Hub'; };
}

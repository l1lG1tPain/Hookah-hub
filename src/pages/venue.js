import { html, icon, setHTML, skeletonCards, plural } from '../lib/ui.js';
import { getVenue, myVenues } from '../lib/api.js';
import { venueShareSheet } from '../lib/venueShare.js';
import { state } from '../lib/store.js';
import { card } from '../components.js';
import { isSafeHref, shortLink } from '../lib/links.js';

export function VenuePage(el, params) {
    const slug = params.get('s');
    setHTML(el, html`<div class="author">
        <section class="vhead" id="head"><div class="panel skel" style="height:120px;width:100%"></div></section>
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
            const links = [['Instagram', v.instagram], ['Сайт', v.website], ['Facebook', v.facebook], ['Telegram', v.telegram]].filter(([, u]) => isSafeHref(u));
            setHTML(el.querySelector('#head'), html`
              <div class="vhead__top">
                ${v.logo_url ? html`<img class="avatar avatar--xl" src="${v.logo_url}" alt="">` : html`<span class="avatar avatar--xl">${v.name.slice(0, 1).toUpperCase()}</span>`}
                <div class="vhead__title">
                  <p class="eyebrow">Заведение${v.verified ? ' · проверено' : ''}</p>
                  <h1 class="display display--sm">${v.name}</h1>
                  <p class="muted vhead__count">${n} ${plural(n, 'микс', 'микса', 'миксов')} в меню</p>
                </div>
                <div class="vhead__actions">
                  <button class="icon-btn icon-btn--fill" id="shareVenue" aria-label="QR и ссылка" title="QR и ссылка">${icon('qr')}</button>
                  ${mine ? html`<a class="icon-btn" href="#/profile" aria-label="Управлять" title="Управлять">${icon('edit')}</a>` : ''}
                </div>
              </div>
              ${v.description ? html`<p class="vhead__desc">${v.description}</p>` : ''}
              ${v.city || v.address ? html`<p class="vhead__meta">${v.city ? html`<b>${v.city}</b>` : ''}${v.city && v.address ? ' · ' : ''}${v.address ? (isSafeHref(v.address)
                ? html`<a href="${v.address}" target="_blank" rel="noopener noreferrer">${shortLink(v.address)}</a>` : v.address) : ''}</p>` : ''}
              ${links.length ? html`<div class="vlinks">${links.map(([label, url]) => html`<a class="btn btn--sm" href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`)}</div>` : ''}`);
            el.querySelector('#shareVenue').onclick = () => venueShareSheet(v);
            setHTML(el.querySelector('#list'), n ? v.mixes.map(card) : html`<div class="empty"><b>Меню пока пустое</b></div>`);
        } catch (e) {
            console.error(e);
            setHTML(el.querySelector('#list'), html`<div class="empty"><b>Не удалось загрузить</b></div>`);
        }
    })();
    return () => { document.title = 'Hookah Hub'; };
}

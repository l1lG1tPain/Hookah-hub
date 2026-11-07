import { html, icon, setHTML, skeletonCards, avatar, plural } from '../lib/ui.js';
import { getAuthor, getAuthorByHandle, listMixes } from '../lib/api.js';
import { profileShareSheet } from '../lib/profileShare.js';
import { state } from '../lib/store.js';
import { card } from '../components.js';

export function AuthorPage(el, params) {
    const handle = params.get('h'), idParam = params.get('id');
    setHTML(el, html`<div class="author">
        <section class="author__head" id="head"><div class="panel skel" style="height:120px;width:100%"></div></section>
        <div class="grid" id="list">${skeletonCards(3)}</div>
      </div>`);

    (async () => {
        try {
            const a = handle ? await getAuthorByHandle(handle) : await getAuthor(idParam);
            const mixes = a ? await listMixes({ author: a.id, sort: 'new', limit: 100 }) : [];
            if (!a) {
                setHTML(el, html`<div class="empty empty--page"><b>Автор не найден</b><a class="btn" href="#/">На главную</a></div>`);
                return;
            }
            document.title = `${a.name} — Hookah Hub`;
            const since = a.created_at ? new Date(a.created_at).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) : '';
            const isMe = state.user?.id === a.id;
            const rated = mixes.filter((m) => m.votes >= 3);
            const avg = rated.length ? rated.reduce((s, m) => s + m.avg_score * m.votes, 0) / rated.reduce((s, m) => s + m.votes, 0) : null;
            setHTML(el.querySelector('#head'), html`
              ${avatar(a, 'avatar--xl')}
              <div class="author__info">
                <p class="eyebrow">${isMe ? 'Это вы' : 'Автор'}</p>
                <h1 class="display display--sm">${a.name}</h1>
                ${a.handle ? html`<p class="author__handle">@${a.handle}</p>` : ''}
                ${a.bio ? html`<p class="author__bio">${a.bio}</p>` : ''}
                <p class="muted">${mixes.length} ${plural(mixes.length, 'микс', 'микса', 'миксов')}${avg ? ` · средняя оценка ${avg.toFixed(1)}` : ''}${since ? ` · с нами с ${since}` : ''}</p>
              </div>
              <div class="author__actions">
                <button class="btn ${isMe ? '' : 'btn--accent'}" id="shareAuthor">${icon('qr')} QR и ссылка</button>
                ${isMe ? html`<a class="btn btn--accent" href="#/create">Создать микс</a>` : ''}
              </div>`);
            el.querySelector('#shareAuthor').onclick = () => profileShareSheet(a, avg);
            setHTML(el.querySelector('#list'), mixes.length ? mixes.map(card)
                : html`<div class="empty"><b>Пока нет миксов</b>${isMe ? html`<a class="btn btn--accent" href="#/create">Создать первый</a>` : ''}</div>`);
        } catch (e) {
            console.error(e);
            setHTML(el.querySelector('#list'), html`<div class="empty"><b>Не удалось загрузить</b></div>`);
        }
    })();
    return () => { document.title = 'Hookah Hub'; };
}

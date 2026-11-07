// UI-хелперы: безопасные шаблоны, иконки, тосты, шторки, обложки
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** html`...` — экранирует подстановки; raw(...) и массивы raw вставляются как есть */
const RAW = Symbol('raw');
export const raw = (s) => ({ [RAW]: String(s) });
export function html(strings, ...vals) {
    let out = strings[0];
    vals.forEach((v, i) => { out += render(v) + strings[i + 1]; });
    return raw(out);
}
function render(v) {
    if (v == null || v === false) return '';
    if (Array.isArray(v)) return v.map(render).join('');
    if (typeof v === 'object' && RAW in v) return v[RAW];
    return esc(v);
}
export const toNode = (tpl) => {
    const t = document.createElement('template');
    t.innerHTML = render(tpl).trim();
    return t.content.firstElementChild;
};
export const setHTML = (el, tpl) => { el.innerHTML = render(tpl); return el; };

/* ---------------- иконки (24×24, stroke) ---------------- */
const P = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/>',
    heart: '<path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8.1 3.6 4.5 7.2 4.5c2 0 3.5 1.1 4.8 2.8 1.3-1.7 2.8-2.8 4.8-2.8 3.6 0 5.7 3.6 4.5 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    back: '<path d="M15 5 8 12l7 7"/>',
    share: '<path d="M12 3v13M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    flame: '<path d="M12 22c4 0 7-2.8 7-6.8 0-3.3-2-5.6-3.6-7.4-.5 1.7-1.4 2.7-2.6 3.2.3-3.5-1.4-6.6-4.3-8 .3 3.2-1.6 5.1-3 7.1A8 8 0 0 0 5 15.2C5 19.2 8 22 12 22z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>',
    logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    auto: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3m4 0v4h-4m-3 0v-1"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
};
export const icon = (name, cls = '') =>
    raw(`<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`);

export const brandIcon = {
    whatsapp: raw('<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>'),
    telegram: raw('<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.9 4.6 18.7 19.8c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.2-8.3c.4-.4-.1-.6-.6-.2L6.1 13.4l-4.9-1.5c-1-.3-1.1-1 .2-1.5L20.5 3c.9-.3 1.7.2 1.4 1.6z"/></svg>'),
    google: raw('<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"/></svg>'),
};

/* ---------------- оценки ---------------- */
export const SCORES = [
    { n: 5, label: 'Отлично', emoji: '💯' },
    { n: 4, label: 'Хорошо', emoji: '🔥' },
    { n: 3, label: 'Пойдёт', emoji: '😎' },
    { n: 2, label: 'Так себе', emoji: '🙂' },
    { n: 1, label: 'Не зашло', emoji: '😐' },
];
export const fmtScore = (v) => (v == null || Number.isNaN(v) ? '—' : (Math.round(v * 10) / 10).toFixed(1));
export function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
}
export const votesText = (n) => `${n} ${plural(n, 'оценка', 'оценки', 'оценок')}`;
export const scoreTone = (v) => (v == null ? 'none' : v >= 4.3 ? 'hi' : v >= 3.5 ? 'mid' : 'low');

/* ---------------- обложка ---------------- */
function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
export function cover(item, cls = '') {
    if (item.cover_url) {
        return html`<div class="cover ${cls}"><img src="${item.cover_url}" alt="" loading="lazy" decoding="async" draggable="false"></div>`;
    }
    const h = hash(item.id + item.name);
    const hue = [18, 28, 340, 300, 265, 160, 40][h % 7];
    const letter = (item.name || '?').trim().charAt(0).toUpperCase();
    return html`<div class="cover cover--art ${cls}" style="--h:${hue}"><span class="cover__smoke"></span><span class="cover__letter">${letter}</span></div>`;
}

/* ---------------- тосты ---------------- */
let toastBox;
export function toast(msg, kind = '') {
    toastBox ??= document.body.appendChild(Object.assign(document.createElement('div'), { className: 'toasts' }));
    const t = toNode(html`<div class="toast ${kind}" role="status">${msg}</div>`);
    while (toastBox.children.length >= 2) toastBox.firstElementChild.remove();
    toastBox.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, 2600);
}

/* ---------------- шторка / модалка ---------------- */
export function sheet(content, { onClose } = {}) {
    const wrap = toNode(html`<div class="sheet" role="dialog" aria-modal="true">
      <div class="sheet__backdrop" data-close></div>
      <div class="sheet__panel">
        <button class="icon-btn sheet__x" data-close aria-label="Закрыть">${icon('x')}</button>
        <div class="sheet__body"></div>
      </div></div>`);
    const body = wrap.querySelector('.sheet__body');
    typeof content === 'string' || content?.nodeType ? body.append(content) : setHTML(body, content);
    const close = () => {
        wrap.classList.remove('open');
        document.removeEventListener('keydown', onKey);
        setTimeout(() => wrap.remove(), 250);
        onClose?.();
    };
    const onKey = (e) => e.key === 'Escape' && close();
    wrap.addEventListener('click', (e) => e.target.closest('[data-close]') && close());
    document.addEventListener('keydown', onKey);
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('open'));
    return { el: wrap, body, close };
}

export function debounce(fn, ms = 250) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

export function skeletonCards(n = 6) {
    return Array.from({ length: n }, () => html`<div class="card card--skel"><div class="cover skel"></div><div class="card__body"><div class="skel skel--line"></div><div class="skel skel--line short"></div></div></div>`);
}

/* ---------------- аватары (как в Telegram) ---------------- */
const AV_COLORS = [
    ['#ff885e', '#ff516a'], // красный
    ['#ffcd6a', '#ffa85c'], // оранжевый
    ['#82b1ff', '#665fff'], // фиолетовый
    ['#a0de7e', '#54cb68'], // зелёный
    ['#53edd6', '#28c9b7'], // бирюзовый
    ['#72d5fd', '#2a9ef1'], // голубой
    ['#e0a2f3', '#d669ed'], // розовый
];
export function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    const a = [...parts[0]][0] || '';
    const b = parts.length > 1 ? [...parts[1]][0] || '' : '';
    return (a + b).toUpperCase();
}
function avatarColors(name) {
    let h = 0;
    for (const c of String(name || '').trim().toLowerCase()) h = (h * 31 + c.codePointAt(0)) >>> 0;
    return AV_COLORS[h % AV_COLORS.length];
}
/** Фото, если есть, иначе цветной кружок с инициалами — цвет зависит от имени */
export function avatar(user, cls = '') {
    const name = user?.name || '';
    if (!user?.avatar_url && name === 'Hookah Hub') return html`<span class="avatar ${cls}"><img src="/icons/192.png" alt="" draggable="false"></span>`;
    if (user?.avatar_url) return html`<span class="avatar ${cls}"><img src="${user.avatar_url}" alt="" draggable="false"></span>`;
    const [c1, c2] = avatarColors(name);
    return html`<span class="avatar ${cls}" style="background:linear-gradient(180deg,${c1},${c2})">${initials(name)}</span>`;
}

/* ---------------- поделиться ---------------- */
export async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* фоллбек ниже */ }
    try {
        const ta = Object.assign(document.createElement('textarea'), { value: text });
        ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
    } catch { return false; }
}

/** Ссылка для шаринга: /m/<id> или /t/<id> — страница с превью для мессенджеров, затем редирект в приложение */
/** Публичная ссылка на личную страницу: /u/<ник> (с превью) или, пока ника нет, прямой хэш-маршрут */
export const profileUrl = (a) => a.handle ? `${location.origin}/u/${encodeURIComponent(a.handle)}` : `${location.origin}/#/author?id=${a.id}`;

/** Публичная ссылка на заведение: /v/<slug> (с превью) */
export const venueUrl = (v) => `${location.origin}/v/${encodeURIComponent(v.slug)}`;

export const shareUrl = (type, id) => `${location.origin}/${type === 'mix' ? 'm' : 't'}/${encodeURIComponent(id)}`;

export function shareLink({ title, text, url, item, type }) {
    const full = `${text}\n\n${url}`;
    const enc = encodeURIComponent;
    const sub = item ? [type === 'mix' ? 'Микс' : 'Табак', item.brand_name, item.votes ? `★ ${fmtScore(item.avg_score)}` : ''].filter(Boolean).join(' · ') : '';
    const s = sheet(html`<div class="share">
        <h2 class="h2">Поделиться</h2>
        ${item ? html`<div class="share__preview">${cover(item, 'share__cover')}
          <div><b>${item.name}</b><span>${sub}</span></div></div>` : html`<p class="muted small share__title">${title}</p>`}
        <div class="share__grid">
          <a class="share__btn" data-x href="https://t.me/share/url?url=${enc(url)}&text=${enc(text)}" target="_blank" rel="noopener">
            <span class="share__ic share__ic--tg">${brandIcon.telegram}</span>Telegram</a>
          <a class="share__btn" data-x href="https://wa.me/?text=${enc(full)}" target="_blank" rel="noopener">
            <span class="share__ic share__ic--wa">${brandIcon.whatsapp}</span>WhatsApp</a>
          ${item ? html`<button class="share__btn" data-img><span class="share__ic share__ic--hot">${icon('flame')}</span>Картинкой</button>` : ''}
          <button class="share__btn" data-copy="link"><span class="share__ic">${icon('copy')}</span>Ссылка</button>
          <button class="share__btn" data-copy="all"><span class="share__ic">${icon('share')}</span>Текст и ссылка</button>
          ${navigator.share ? html`<button class="share__btn" data-native><span class="share__ic">${icon('plus')}</span>Ещё…</button>` : ''}
        </div>
      </div>`);
    s.body.addEventListener('click', async (e) => {
        const c = e.target.closest('[data-copy]');
        if (c) {
            const ok = await copyText(c.dataset.copy === 'link' ? url : full);
            toast(ok ? (c.dataset.copy === 'link' ? 'Ссылка скопирована' : 'Скопировано') : 'Не удалось скопировать', ok ? '' : 'err');
            if (ok) s.close();
        } else if (e.target.closest('[data-img]')) {
            const btn = e.target.closest('[data-img]'); btn.disabled = true;
            try {
                const { makeShareCard } = await import('./sharecard.js');
                const blob = await makeShareCard(item, type, url);
                const file = new File([blob], 'hookah-hub.png', { type: 'image/png' });
                if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title, text: full }); }
                else {
                    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'hookah-hub.png' });
                    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Картинка сохранена');
                }
                s.close();
            } catch (err) { if (err?.name !== 'AbortError') toast('Не удалось собрать картинку', 'err'); }
            btn.disabled = false;
        } else if (e.target.closest('[data-native]')) {
            try { await navigator.share({ title, text, url }); s.close(); }
            catch (err) { if (err?.name !== 'AbortError') toast('Системное меню недоступно — скопируйте ссылку', 'err'); }
        } else if (e.target.closest('[data-x]')) {
            setTimeout(() => s.close(), 300);
        }
    });
}

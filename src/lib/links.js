/* Нормализация внешних ссылок заведения. Возвращает https-URL или '' (пусто); бросает Error при мусоре. */
export const MAX_LINK = 200;

const clean = (s) => String(s ?? '').trim();
const bad = () => { throw new Error('Некорректная ссылка'); };

function finish(url) {
    if (url.length > MAX_LINK) throw new Error('Ссылка: до 200 символов');
    let u;
    try { u = new URL(url); } catch { bad(); }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') bad();
    if (!u.hostname.includes('.')) bad();
    return u.pathname === '/' && !u.search && !u.hash ? u.origin : u.href;
}

function base(raw) {
    const s = clean(raw);
    if (!s) return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:\/\//i.test(s)) bad(); // javascript:, data:, mailto: и т.п.
    return s;
}

/** Общий случай: схему не указали — добавляем https:// */
export function normLink(raw) {
    const s = base(raw);
    if (!s) return '';
    return finish(/^https?:\/\//i.test(s) ? s : 'https://' + s.replace(/^\/+/, ''));
}

/** Instagram: @name | name | instagram.com/name | полный URL */
export function normInstagram(raw) {
    const s = base(raw);
    if (!s) return '';
    if (/^@?[a-z0-9._]+$/i.test(s)) return finish('https://instagram.com/' + s.replace(/^@/, ''));
    return normLink(s);
}

/** Telegram: @name | t.me/name | полный URL */
export function normTelegram(raw) {
    const s = base(raw);
    if (!s) return '';
    if (/^@?[a-z0-9_]{3,}$/i.test(s)) return finish('https://t.me/' + s.replace(/^@/, ''));
    return normLink(s);
}

export const normWebsite = normLink;
export const normFacebook = normLink;

/** Весь набор полей заведения → нормализованный; адрес — обычный текст до 200 */
export function normVenueLinks({ instagram, website, facebook, telegram, address } = {}) {
    let a = clean(address);
    // Адрес-ссылка (карты и т.п.): http(s):// или «домен/путь» без пробелов → нормализуем; иначе обычный текст
    if (/^https?:\/\/\S+$/i.test(a) || /^[a-z0-9-]+(\.[a-z0-9-]+)+\/\S*$/i.test(a)) a = normLink(a);
    if (a.length > MAX_LINK) throw new Error('Адрес: до 200 символов');
    return {
        instagram: normInstagram(instagram) || null,
        website: normWebsite(website) || null,
        facebook: normFacebook(facebook) || null,
        telegram: normTelegram(telegram) || null,
        address: a || null,
    };
}

/** Короткая подпись для ссылки: домен без www + «/…», если есть путь */
export function shortLink(u, max = 32) {
    try {
        const x = new URL(u);
        const s = x.hostname.replace(/^www\./, '') + (x.pathname.length > 1 || x.search ? '/…' : '');
        return s.length > max ? s.slice(0, max - 1) + '…' : s;
    } catch { return String(u).slice(0, max); }
}

/** Безопасно ли выводить как href (для публичной страницы: данные из базы тоже не доверяем) */
export const isSafeHref = (u) => /^https?:\/\//i.test(String(u || ''));

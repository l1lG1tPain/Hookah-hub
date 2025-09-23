// src/app/state.js
// Единая работа с авторизацией по сессии (x-session)

const LS_SESSION = 'hhsession';        // строковый токен сессии
const LS_USER    = 'hh:user_safe';     // кэш «безопасного» профиля ({ id, short, name, avatar_url })

/* -------- localStorage helpers -------- */
export function getSession() {
    try { return localStorage.getItem(LS_SESSION) || ''; } catch { return ''; }
}
export function setSession(token) {
    try {
        if (token) localStorage.setItem(LS_SESSION, token);
        else localStorage.removeItem(LS_SESSION);
        dispatchAuthChange();
    } catch {}
}

export function getSafeUserCached() {
    try { return JSON.parse(localStorage.getItem(LS_USER) || 'null'); } catch { return null; }
}
function setSafeUserCached(u) {
    try {
        if (u) localStorage.setItem(LS_USER, JSON.stringify(u));
        else localStorage.removeItem(LS_USER);
    } catch {}
}

/* -------- API helpers -------- */
export function authHeaders() {
    const s = getSession();
    return s ? { 'x-session': s } : {};
}

export async function refreshSafeUser() {
    const s = getSession();
    if (!s) { setSafeUserCached(null); return null; }

    try {
        const r = await fetch('/api/whoami', { headers: { ...authHeaders() } });
        const j = await r.json();
        if (j?.ok && j.user) {
            setSafeUserCached(j.user);
            return j.user;
        }
    } catch {}
    setSafeUserCached(null);
    return null;
}

/**
 * Возвращает «безопасного» пользователя.
 * Если нет кэша, попробует подтянуть через /api/whoami.
 */
export async function getSafeUser() {
    const cached = getSafeUserCached();
    if (cached) return cached;
    return await refreshSafeUser();
}

/* -------- events -------- */
const AUTH_EVENT = 'hh:auth:changed';
function dispatchAuthChange() {
    try { document.dispatchEvent(new CustomEvent(AUTH_EVENT)); } catch {}
}
export function onAuthChange(cb) {
    document.addEventListener(AUTH_EVENT, cb);
    return () => document.removeEventListener(AUTH_EVENT, cb);
}

/* -------- compatibility layer (старое API) -------- */
// РАНЬШЕ фронт вызывал getCurrentUser() и ждал там объект с tg_id.
// Теперь возвращаем «safe»-профиль (без tg_id). Если его нет — null.
export async function getCurrentUser() {
    return await getSafeUser();
}

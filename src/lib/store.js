// Состояние приложения: пользователь, избранное, мои оценки.
import { supabase, DEMO } from './supabase.js';
import * as api from './api.js';

const listeners = new Set();
export const state = {
    ready: false,       // первичная проверка сессии завершена
    user: null,         // профиль из hh_me()
    favs: new Set(),    // 'mix:<id>' | 'tobacco:<id>'
    ratings: new Map(), // 'mix:<id>' -> 1..5
};

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } }); }

const key = (type, id) => `${type}:${id}`;
export const isFav = (type, id) => state.favs.has(key(type, id));
export const myScore = (type, id) => state.ratings.get(key(type, id)) || 0;

async function loadPersonal() {
    try {
        const [me, favs, rts] = await Promise.all([api.fetchMe(), api.myFavorites(), api.myRatings()]);
        state.user = me;
        state.favs = new Set(favs.map((f) => key(f.item_type, f.item_id)));
        state.ratings = new Map(rts.map((r) => [key(r.item_type, r.item_id), r.score]));
    } catch (e) {
        console.warn('loadPersonal', e);
        state.user = null; state.favs = new Set(); state.ratings = new Map();
    }
    state.ready = true;
    emit();
}

function clearPersonal() {
    state.user = null; state.favs = new Set(); state.ratings = new Map();
    state.ready = true;
    emit();
}

export async function initAuth() {
    if (DEMO) return loadPersonal();
    const { data } = await supabase.auth.getSession();
    if (data.session) await loadPersonal(); else clearPersonal();

    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            if (session) setTimeout(loadPersonal, 0); // вне колбэка — рекомендация supabase-js
        } else if (event === 'SIGNED_OUT') {
            clearPersonal();
        }
    });
}

export async function refreshUser() { await loadPersonal(); }

export async function toggleFav(type, id) {
    const k = key(type, id);
    const was = state.favs.has(k);
    was ? state.favs.delete(k) : state.favs.add(k);
    emit();
    try {
        const now = await api.toggleFavorite(type, id);
        now ? state.favs.add(k) : state.favs.delete(k);
        if (state.user) state.user.favorites = state.favs.size;
        emit();
        return now;
    } catch (e) {
        was ? state.favs.add(k) : state.favs.delete(k);
        emit();
        throw e;
    }
}

export async function setRating(type, id, score) {
    const k = key(type, id);
    const prev = state.ratings.get(k);
    state.ratings.set(k, score);
    emit();
    try {
        await api.rate(type, id, score);
        if (state.user && !prev) state.user.ratings = (state.user.ratings || 0) + 1;
        emit();
    } catch (e) {
        prev ? state.ratings.set(k, prev) : state.ratings.delete(k);
        emit();
        throw e;
    }
}

/* ---------------- вход ---------------- */
const redirectTo = () => `${location.origin}/#/profile`;

export async function signInWithGoogle() {
    if (DEMO) { api.demoAuth.signIn('google'); return loadPersonal(); }
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } });
    if (error) throw error;
}

export async function sendEmailCode(email) {
    if (DEMO) return;
    const { error } = await supabase.auth.signInWithOtp({
        email, options: { shouldCreateUser: true, emailRedirectTo: redirectTo() },
    });
    if (error) throw error;
}

export async function verifyEmailCode(email, token) {
    if (DEMO) { api.demoAuth.signIn('email'); return loadPersonal(); }
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;
}

/** Telegram: создаём одноразовый state, открываем бота, ждём подтверждения */
export async function telegramStart() {
    if (DEMO) return { state: 'demo', httpsLink: 'https://t.me/', tgLink: 'tg://' };
    const r = await fetch('/api/auth-start', { method: 'POST' });
    const j = await r.json().catch(() => null);
    if (!j?.ok) throw new Error('Не удалось начать вход через Telegram');
    return j;
}

/** Возвращает 'ok' | 'wait' | 'expired' | 'error' */
export async function telegramPoll(st) {
    if (DEMO) { api.demoAuth.signIn('telegram'); await loadPersonal(); return 'ok'; }
    const r = await fetch(`/api/auth-wait?state=${encodeURIComponent(st)}`, { cache: 'no-store' });
    const j = await r.json().catch(() => null);
    if (j?.ok && j.token_hash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: j.token_hash, type: 'magiclink' });
        if (error) throw error;
        return 'ok';
    }
    if (j?.wait) return 'wait';
    if (j?.error === 'expired' || j?.error === 'consumed') return 'expired';
    return r.ok ? 'wait' : 'error';
}

export async function signOut() {
    if (DEMO) { api.demoAuth.signOut(); return clearPersonal(); }
    await supabase.auth.signOut();
    clearPersonal();
}

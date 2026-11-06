/* Web Push на клиенте: подписка по нажатию кнопки, настройки хранятся в Supabase */
import { DEMO } from './supabase.js';
import { pushSubscribe, pushStatus, pushPrefs, pushUnsubscribe } from './api.js';
import { isStandalone, platform } from './pwa.js';

const KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

const b64 = (s) => {
    const pad = '='.repeat((4 - (s.length % 4)) % 4), raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** 'off' — не показываем блок, 'install' — на iPhone нужна установка, 'ready' — можно включать, 'denied' — запрещено в браузере */
export function pushMode() {
    if (DEMO || !KEY || !('serviceWorker' in navigator) || !import.meta.env.PROD) return 'off';
    if (platform() === 'ios' && !isStandalone()) return 'install';
    if (!('PushManager' in window) || !('Notification' in window)) return 'off';
    return Notification.permission === 'denied' ? 'denied' : 'ready';
}

async function currentSub() {
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
}

/** { on, prefs } для текущего устройства */
export async function pushState() {
    const sub = await currentSub();
    if (!sub) return { on: false };
    try { const prefs = await pushStatus(sub.endpoint); return prefs ? { on: true, prefs } : { on: false }; } catch { return { on: false }; }
}

export async function enablePush() {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Уведомления не разрешены в браузере');
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(KEY) });
    return pushSubscribe(sub.toJSON());
}

export async function disablePush() {
    const sub = await currentSub();
    if (!sub) return;
    await pushUnsubscribe(sub.endpoint).catch(() => {});
    await sub.unsubscribe().catch(() => {});
}

export async function setPrefs(p) {
    const sub = await currentSub();
    if (sub) await pushPrefs(sub.endpoint, p);
}

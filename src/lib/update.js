/* Обновление PWA: новый service worker включается сам (skipWaiting), а страница показывает плашку
   «Вышла новая версия — обновимся через N с» и перезагружается. */
import { html, toNode } from './ui.js';

const SECONDS = 8;
let shown = false;

export function showUpdateBanner() {
    if (shown) return;
    shown = true;
    let left = SECONDS;
    const el = toNode(html`<div class="updbar" role="status">
        <span class="updbar__txt">Вышла новая версия. Обновимся через <b id="updN">${SECONDS}</b> с</span>
        <button class="btn btn--sm btn--accent" id="updNow" type="button">Сейчас</button>
      </div>`);
    document.body.appendChild(el);
    const go = () => location.reload();
    el.querySelector('#updNow').onclick = go;
    const t = setInterval(() => {
        left -= 1;
        const n = el.querySelector('#updN'); if (n) n.textContent = String(left);
        if (left <= 0) { clearInterval(t); go(); }
    }, 1000);
}

/** Регистрирует SW и следит за новыми версиями */
export function initUpdates() {
    if (!('serviceWorker' in navigator)) return;
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) showUpdateBanner(); });
    navigator.serviceWorker.register('/sw.js').then((reg) => {
        const check = () => reg.update().catch(() => {});
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
        setInterval(check, 30 * 60 * 1000);
    }).catch(() => {});
}

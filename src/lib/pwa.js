/* Установка PWA: Android/desktop — нативный диалог, iOS — подсказка. */
import { html, raw, icon, sheet, toast } from './ui.js';

const KEY = 'hh-pwa-dismiss';
const WEEK = 7 * 864e5;

let deferred = null;
const subs = new Set();
const emit = () => subs.forEach((f) => f());

export const isStandalone = () =>
    matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches
    || navigator.standalone === true;

export function platform() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return 'desktop';
}
// в Telegram/Instagram и т.п. «На экран Домой» недоступно — нужен Safari
const inAppBrowser = () => /FBAN|FBAV|Instagram|Line\/|MicroMessenger|Telegram|TikTok/i.test(navigator.userAgent);

export function initPwa() {
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; emit(); });
    window.addEventListener('appinstalled', () => { deferred = null; localStorage.removeItem(KEY); toast('Hookah Hub установлен 🦈'); emit(); });
    matchMedia('(display-mode: standalone)').addEventListener?.('change', emit);
}
export const subscribePwa = (fn) => { subs.add(fn); return () => subs.delete(fn); };

/** Что показать пользователю: null — ничего (уже установлено / не поддерживается) */
export function installMode() {
    if (isStandalone()) return null;
    if (deferred) return 'prompt';
    if (platform() === 'ios') return 'ios';
    return null;
}

export async function install() {
    if (deferred) {
        deferred.prompt();
        const { outcome } = await deferred.userChoice.catch(() => ({}));
        if (outcome === 'accepted') deferred = null;
        emit();
        return;
    }
    if (platform() === 'ios') iosGuide();
}

const SHARE_SVG = raw(`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>`);
const ADD_SVG = raw(`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>`);

export function iosGuide() {
    sheet(html`<div class="iosguide">
        <img class="iosguide__logo" src="/icons/192.png" alt="">
        <h2 class="h2">Установить на iPhone</h2>
        <p class="muted small">Откроется как обычное приложение — без адресной строки, с иконкой на экране.</p>
        ${inAppBrowser() ? html`<p class="iosguide__warn">Сейчас вы во встроенном браузере. Откройте ссылку в <b>Safari</b>, иначе кнопки установки не будет.</p>` : ''}
        <ol class="iosguide__steps">
          <li><span class="iosguide__ic">${SHARE_SVG}</span><span>Нажмите <b>«Поделиться»</b> внизу экрана Safari</span></li>
          <li><span class="iosguide__ic">${ADD_SVG}</span><span>Выберите <b>«На экран “Домой”»</b></span></li>
          <li><span class="iosguide__ic">${icon('flame')}</span><span>Нажмите <b>«Добавить»</b> — и запускайте с главного экрана</span></li>
        </ol>
      </div>`);
}

/* ---------- карточка установки (профиль и главная) ---------- */
export const dismissed = () => { try { return Date.now() - +localStorage.getItem(KEY) < WEEK; } catch { return false; } };
export const dismiss = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch {} };

export function installCard({ compact = false } = {}) {
    const mode = installMode();
    if (!mode) return '';
    return html`<section class="install ${compact ? 'install--compact' : 'panel'}" id="installCard">
        <img class="install__shark" src="/icons/shark.webp" alt="" draggable="false">
        <div class="install__text">
          <b>Установите Hookah Hub</b>
          <span>${mode === 'ios' ? 'Иконка на экране, запуск в один тап, как у обычного приложения' : 'Быстрый запуск с экрана, работает как приложение'}</span>
        </div>
        <button class="btn btn--accent ${compact ? 'btn--sm' : ''}" data-install>${mode === 'ios' ? 'Как установить' : 'Установить'}</button>
        ${compact ? html`<button class="icon-btn install__x" data-install-x aria-label="Скрыть">${icon('x')}</button>` : ''}
      </section>`;
}

/** Делегирование кликов; возвращает отписку. Вызывать один раз на страницу. */
export function bindInstall(root, onChange) {
    const click = (e) => {
        if (e.target.closest('[data-install]')) install();
        else if (e.target.closest('[data-install-x]')) { dismiss(); onChange?.(); }
    };
    root.addEventListener('click', click);
    const off = onChange ? subscribePwa(onChange) : () => {};
    return () => { root.removeEventListener('click', click); off(); };
}

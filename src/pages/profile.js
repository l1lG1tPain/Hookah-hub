import qrcode from 'qrcode-generator';
import { html, raw, icon, brandIcon, setHTML, toast, sheet, toNode, avatar } from '../lib/ui.js';
import { listMixes, myVenues, clearProfile } from '../lib/api.js';
import { loadRatingRows } from './ratings.js';
import {
    state, subscribe, signInWithGoogle, sendEmailCode, verifyEmailCode,
    telegramStart, telegramPoll, signOut, refreshUser,
} from '../lib/store.js';
import { updateName, setProfile, attachImage, clearAvatar } from '../lib/api.js';
import { profileShareSheet } from '../lib/profileShare.js';
import { venuesBlock } from '../lib/venueManage.js';
import { compressImage } from '../lib/photo.js';
import { DEMO } from '../lib/supabase.js';
import { card } from '../components.js';
import { getTheme, setTheme } from '../theme.js';
import { installCard, installMode, bindInstall } from '../lib/pwa.js';
import { pushMode, pushState, enablePush, disablePush, setPrefs } from '../lib/push.js';

const PROVIDERS = { telegram: 'Telegram', google: 'Google', email: 'почту' };
const isTouch = matchMedia('(pointer: coarse)').matches;

export function ProfilePage(el) {
    let mode = '';
    const paint = () => {
        const next = !state.ready ? 'loading' : state.user ? 'user' : 'guest';
        if (next === mode && next !== 'user') return;
        mode = next;
        if (next === 'loading') setHTML(el, html`<div class="profile"><div class="panel skel" style="height:220px"></div></div>`);
        else if (next === 'guest') guest(el);
        else user(el);
    };
    paint();
    const off = subscribe(paint);
    const offInstall = bindInstall(el, () => {
        if (mode === 'user') { mode = ''; paint(); }
        else if (!installMode()) el.querySelector('#installCard')?.remove();
    });
    return () => { off(); offInstall(); };
}

/* ============================== ГОСТЬ ============================== */
function guest(el) {
    setHTML(el, html`<div class="profile profile--guest">
      <section class="auth">
        <img class="auth__mascot" src="/icons/512.png" alt="">
        <h1 class="display display--sm">Ваш профиль<br><em>в Hookah Hub</em></h1>
        <ul class="perks">
          <li>${icon('heart')} Избранное на всех устройствах</li>
          <li>${icon('flame')} Оценки миксов и табаков</li>
          <li>${icon('trophy')} Ваш голос в общем топе</li>
        </ul>
        <div class="auth__btns">
          <button class="btn btn--tg btn--lg" id="tg">${brandIcon.telegram} Войти через Telegram</button>
          <button class="btn btn--light btn--lg" id="google">${brandIcon.google} Войти через Google</button>
          <button class="btn btn--ghost btn--lg" id="emailToggle">${icon('mail')} Войти по почте</button>
        </div>
        <form class="emailform" id="emailForm" hidden>
          <div id="step1">
            <input class="input" type="email" id="email" placeholder="you@example.com" autocomplete="email" required>
            <button class="btn btn--accent" type="submit">Получить код</button>
          </div>
          <div id="step2" hidden>
            <p class="muted small">Код отправлен на <b id="sentTo"></b>. Введите его или откройте ссылку из письма.</p>
            <input class="input input--code" id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="••••••">
            <button class="btn btn--accent" type="button" id="verify">Войти</button>
            <button class="btn btn--link" type="button" id="changeEmail">Другая почта</button>
          </div>
        </form>
        ${installCard()}
        <p class="auth__note">Регистрация не нужна — аккаунт создастся при первом входе. Мы не публикуем ваши контакты.</p>
      </section>
    </div>`);

    const $ = (s) => el.querySelector(s);
    $('#google').onclick = async () => {
        try { await signInWithGoogle(); } catch (e) { toast(e.message || 'Ошибка входа через Google', 'err'); }
    };
    $('#tg').onclick = telegramFlow;

    const form = $('#emailForm');
    $('#emailToggle').onclick = () => { form.hidden = !form.hidden; if (!form.hidden) $('#email').focus(); };
    let email = '';
    form.onsubmit = async (e) => {
        e.preventDefault();
        email = $('#email').value.trim();
        const btn = form.querySelector('[type=submit]');
        btn.disabled = true; btn.textContent = 'Отправляем…';
        try {
            await sendEmailCode(email);
            $('#sentTo').textContent = email;
            $('#step1').hidden = true; $('#step2').hidden = false; $('#code').focus();
        } catch (err) {
            toast(/rate|limit/i.test(err.message) ? 'Слишком много попыток, подождите минуту' : 'Не удалось отправить код', 'err');
        } finally { btn.disabled = false; btn.textContent = 'Получить код'; }
    };
    const verify = async () => {
        const code = $('#code').value.replace(/\D/g, '');
        if (code.length < 6) return toast('Введите код из письма');
        try { await verifyEmailCode(email, code); toast('Добро пожаловать!'); }
        catch { toast('Неверный или устаревший код', 'err'); }
    };
    $('#verify').onclick = verify;
    $('#code').addEventListener('input', (e) => { if (e.target.value.replace(/\D/g, '').length === 6) verify(); });
    $('#changeEmail').onclick = () => { $('#step1').hidden = false; $('#step2').hidden = true; };
}

async function telegramFlow() {
    let stopped = false;
    const s = sheet(html`<div class="tgflow">
        <div class="tgflow__icon">${brandIcon.telegram}</div>
        <h2 class="h2">Вход через Telegram</h2>
        <p class="muted" id="tgStatus">Готовим ссылку…</p>
      </div>`, { onClose: () => { stopped = true; } });
    const status = s.body.querySelector('#tgStatus');
    const box = s.body.querySelector('.tgflow');

    let start;
    try { start = await telegramStart(); }
    catch (e) { status.textContent = e.message; return; }

    const link = start.httpsLink;
    status.remove();
    const qr = qrcode(0, 'M'); qr.addData(link); qr.make();
    box.append(toNode(html`<div class="tgflow__steps">
        <ol>
          <li>Откройте бота <b>Hookah Hub</b> в Telegram</li>
          <li>Нажмите <b>«Запустить»</b> — это подтвердит вход</li>
          <li>Вернитесь сюда — вы уже будете в аккаунте</li>
        </ol>
        <a class="btn btn--tg btn--lg" href="${link}" target="_blank" rel="noopener">${brandIcon.telegram} Открыть Telegram</a>
        ${!isTouch ? html`<div class="tgflow__qr"><div class="qr">${raw(qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }))}</div>
          <span class="muted small">или отсканируйте камерой телефона</span></div>` : ''}
        <p class="tgflow__wait"><span class="spinner"></span> Ждём подтверждения…</p>
      </div>`));
    if (isTouch) window.open(start.tgLink || link, '_blank');

    const t0 = Date.now();
    const tick = async () => {
        if (stopped) return;
        try {
            const r = await telegramPoll(start.state);
            if (r === 'ok') { s.close(); toast('Вы вошли через Telegram'); return; }
            if (r === 'expired' || Date.now() - t0 > 10 * 60e3) {
                box.querySelector('.tgflow__wait').textContent = 'Ссылка устарела — закройте окно и попробуйте снова';
                return;
            }
        } catch { /* сеть — пробуем дальше */ }
        setTimeout(tick, 1500);
    };
    setTimeout(tick, 1500);
}

/* ============================== ПОЛЬЗОВАТЕЛЬ ============================== */
function user(el) {
    const u = state.user;
    const since = u.created_at ? new Date(u.created_at).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) : '';
    const theme = getTheme();
    const hadList = el.querySelector('#myRatings')?.innerHTML;

    setHTML(el, html`<div class="profile">
      <section class="me panel">
        ${DEMO ? avatar(u, 'avatar--md') : html`<button class="avatar-edit" id="avatarBtn" aria-label="Сменить фото">${avatar(u, 'avatar--md')}<span class="avatar-edit__badge">${icon('edit')}</span></button>`}
        <div class="me__info">
          <div class="me__name"><h1>${u.name}</h1><button class="icon-btn" id="edit" aria-label="Изменить имя">${icon('edit')}</button></div>
          ${u.handle ? html`<button class="me__handle" id="copyHandle" type="button" title="Скопировать ник">@${u.handle}</button>` : ''}
        </div>
        <div class="stats">
          <a class="stat" href="#/author?id=${u.id}&pub=1"><b>${u.mixes ?? 0}</b><span>миксов</span></a>
          <a class="stat" href="#/favorites"><b>${u.favorites ?? 0}</b><span>в избранном</span></a>
          <a class="stat" href="#/ratings"><b>${u.ratings ?? 0}</b><span>оценок</span></a>
        </div>
      </section>

      <section class="tiles">
        ${u.handle ? html`<a class="tile" href="#/author?h=${u.handle}&pub=1"><b>Моя страница</b><span>@${u.handle}</span></a>` : ''}
        <div class="tiles__venues" id="venuesBox"></div>
      </section>

      <section class="panel mypage">
        <div class="mypage__txt"><b>Ссылка и QR</b><span>${u.handle ? `hookahhub.netlify.app/u/${u.handle}` : 'Задайте ник — получите ссылку и QR для миксов'}</span></div>
        <div class="mypage__btns">
          <button class="btn btn--sm" id="pageEdit">${icon('edit')} ${u.handle ? 'Изменить' : 'Задать ник'}</button>
          ${u.handle ? html`<button class="btn btn--sm btn--accent" id="pageQr">${icon('qr')} QR</button>` : ''}
        </div>
      </section>

      <section class="block" id="venuesManage"></section>

      <a class="btn btn--accent btn--lg btn--block" href="#/create">${icon('plus')} Создать микс</a>

      ${installCard()}

      <section class="block">
        <h2 class="h2">Мои миксы</h2>
        <div class="grid grid--compact" id="myMixes"></div>
      </section>

      <section class="block">
        <div class="block__head"><h2 class="h2">Мои оценки</h2><a class="btn btn--sm" id="allRatings" href="#/ratings" hidden></a></div>
        <div class="rows" id="myRatings">${hadList ? raw(hadList) : html`<div class="row row--skel"><div class="skel"></div></div>`}</div>
      </section>

      <section class="panel settings" id="pushBox" hidden></section>

      <section class="panel settings">
        <div class="setting setting--theme">
          <span>Тема</span>
          <div class="seg seg--sm seg--full" id="theme">
            ${[['dark', 'Тёмная', 'moon'], ['light', 'Светлая', 'sun'], ['auto', 'Авто', 'auto']].map(([k, l, i]) =>
                html`<button data-theme="${k}" aria-selected="${theme === k}">${icon(i)} <span>${l}</span></button>`)}
          </div>
        </div>
      </section>
      <button class="btn btn--danger btn--block" id="logout">${icon('logout')} Выйти из аккаунта</button>
      <p class="foot muted small">Hookah Hub · сделано с 🦈 для любителей кальяна<br><a href="/privacy.html" target="_blank">Конфиденциальность</a> · <a href="/terms.html" target="_blank">Условия</a></p>
    </div>`);

    const $ = (s) => el.querySelector(s);
    $('#edit').onclick = () => editName(u.name);
    $('#pageEdit').onclick = () => editPage(u);
    $('#pageQr')?.addEventListener('click', () => profileShareSheet(u));
    $('#avatarBtn')?.addEventListener('click', () => editAvatar(u));
    $('#copyHandle')?.addEventListener('click', () => copyText('@' + u.handle));
    $('#logout').onclick = async () => { await signOut(); toast('Вы вышли из аккаунта'); };
    $('#theme').onclick = (e) => {
        const b = e.target.closest('[data-theme]'); if (!b) return;
        setTheme(b.dataset.theme);
        $('#theme').querySelectorAll('button').forEach((x) => x.setAttribute('aria-selected', x === b));
    };
    pushBlock($('#pushBox'));
    venueTiles($('#venuesBox'));
    venuesBlock($('#venuesManage'));
    loadMyRatings($('#myRatings'), $('#allRatings'));
    loadMyMixes($('#myMixes'), u.id);
}

async function copyText(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
        else {
            const t = Object.assign(document.createElement('textarea'), { value: text });
            t.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
            document.body.appendChild(t); t.select();
            const ok = document.execCommand('copy'); t.remove();
            if (!ok) throw new Error('copy');
        }
        toast('Ник скопирован');
    } catch { toast('Не удалось скопировать', 'err'); }
}

async function venueTiles(box) {
    // Плитка-ссылка для быстрого входа + полный блок управления (название, ссылка, команда, QR)
    try {
        const list = await myVenues();
        if (list.length === 1) setHTML(box, html`<a class="tile" href="#/venue?s=${list[0].slug}"><b>Мои заведения</b><span>${list[0].name}</span></a>`);
    } catch { /* блок управления ниже всё равно покажется */ }
}

async function loadMyMixes(box, id) {
    try {
        const mixes = await listMixes({ author: id, limit: 100 });
        setHTML(box, mixes.length ? mixes.map(card) : html`<a class="create-cta" href="#/create">
            <span class="create-cta__ic">${icon('plus')}</span>
            <span><b>Соберите свой первый микс</b><small>Он появится в ленте с вашим именем</small></span></a>`);
    } catch {
        setHTML(box, html`<div class="empty"><b>Не удалось загрузить</b></div>`);
    }
}

async function loadMyRatings(box, linkEl) {
    const total = await loadRatingRows(box, 5);
    if (linkEl && total > 5) { linkEl.textContent = `Все (${total})`; linkEl.hidden = false; }
}

function editAvatar(u) {
    const s = sheet(html`<div class="nameform">
        <h2 class="h2">Фото профиля</h2>
        <label class="btn btn--accent btn--lg" style="text-align:center;cursor:pointer">Выбрать фото<input type="file" accept="image/*" id="avFile" hidden></label>
        ${u.avatar_url ? html`<button class="btn btn--ghost" id="avDel" type="button">Убрать фото</button>` : ''}
      </div>`);
    s.body.querySelector('#avFile').onchange = async (e) => {
        const file = e.target.files?.[0]; if (!file) return;
        try {
            toast('Загружаем…');
            const img = await compressImage(file);
            await attachImage('avatar', null, img);
            await refreshUser(); s.close(); toast('Фото обновлено');
        } catch (err) { toast(err.message || 'Не удалось загрузить фото', 'err'); }
    };
    s.body.querySelector('#avDel')?.addEventListener('click', async () => {
        try { await clearAvatar(); await refreshUser(); s.close(); toast('Фото убрано'); }
        catch { toast('Не удалось убрать фото', 'err'); }
    });
}

function editPage(u) {
    const s = sheet(html`<form class="nameform">
        <h2 class="h2">Моя страница</h2>
        <label class="field"><span class="muted small">Ник — для ссылки /u/ник (латиница, цифры, _; 3–20)</span>
          <input class="input" id="hd" value="${u.handle || ''}" maxlength="20" autocapitalize="none" autocomplete="off" spellcheck="false" placeholder="например, smoke_master"></label>
        <label class="field"><span class="muted small">О себе (до 160 символов)</span>
          <textarea class="input" id="bio" rows="3" maxlength="160" placeholder="Люблю фруктовые миксы с холодком">${u.bio || ''}</textarea></label>
        <button class="btn btn--accent btn--lg" type="submit">Сохранить</button>
        ${u.handle ? html`<button class="btn btn--danger" id="pgDel" type="button">Удалить страницу</button>` : ''}
      </form>`);
    s.body.querySelector('#pgDel')?.addEventListener('click', async () => {
        if (!confirm(`Удалить страницу?

Ник @${u.handle} освободится, и его может занять другой. Вернуть нельзя. Ссылка /u/${u.handle} и QR перестанут работать.`)) return;
        try { await clearProfile(); await refreshUser(); s.close(); toast('Страница удалена'); }
        catch (err) { toast(err.message || 'Не удалось удалить', 'err'); }
    });
    const hd = s.body.querySelector('#hd');
    hd.addEventListener('input', () => { hd.value = hd.value.toLowerCase().replace(/[^a-z0-9_]/g, ''); });
    s.body.querySelector('form').onsubmit = async (e) => {
        e.preventDefault();
        const handle = hd.value.trim();
        if (handle && handle.length < 3) return toast('Ник — минимум 3 символа');
        try { await setProfile(handle, s.body.querySelector('#bio').value.trim()); await refreshUser(); s.close(); toast('Страница обновлена'); }
        catch (err) { toast(err.message || 'Не удалось сохранить', 'err'); }
    };
}

function editName(current) {
    const s = sheet(html`<form class="nameform">
        <h2 class="h2">Как вас называть?</h2>
        <input class="input" id="nm" value="${current || ''}" minlength="2" maxlength="40" required autocomplete="nickname">
        <button class="btn btn--accent btn--lg" type="submit">Сохранить</button>
      </form>`);
    const input = s.body.querySelector('#nm');
    setTimeout(() => input.focus(), 50);
    s.body.querySelector('form').onsubmit = async (e) => {
        e.preventDefault();
        const name = input.value.trim();
        if (name.length < 2) return toast('Минимум 2 символа');
        try { await updateName(name); await refreshUser(); s.close(); toast('Имя обновлено'); }
        catch { toast('Не удалось сохранить', 'err'); }
    };
}

/* ============================== УВЕДОМЛЕНИЯ ============================== */
const PUSH_OPTS = [['ratings', 'Оценки моих миксов'], ['daily', 'Микс дня (вечером)'], ['news', 'Новое в каталоге (по пятницам)']];

async function pushBlock(box) {
    const mode = pushMode();
    if (mode === 'off') return;
    box.hidden = false;
    if (mode === 'install') {
        setHTML(box, html`<div class="setting"><span>${icon('flame')} Уведомления</span></div>
          <p class="muted small push__note">На iPhone уведомления работают только в установленном приложении: добавьте Hookah Hub на экран «Домой» и откройте его оттуда.</p>`);
        return;
    }
    if (mode === 'denied') {
        setHTML(box, html`<div class="setting"><span>${icon('flame')} Уведомления</span></div>
          <p class="muted small push__note">Уведомления заблокированы в настройках браузера для этого сайта. Разрешите их там и обновите страницу.</p>`);
        return;
    }
    const render = async () => {
        const st = await pushState().catch(() => ({ on: false }));
        setHTML(box, html`<div class="setting"><span>${icon('flame')} Уведомления</span>
            <button class="btn btn--sm ${st.on ? 'btn--ghost' : 'btn--accent'}" id="pushToggle">${st.on ? 'Выключить' : 'Включить'}</button></div>
          ${st.on ? html`<div class="push__opts">${PUSH_OPTS.map(([k, l]) =>
              html`<label class="push__opt"><input type="checkbox" data-pref="${k}" ${st.prefs[k] ? 'checked' : ''}><span>${l}</span></label>`)}</div>`
            : html`<p class="muted small push__note">Скажем, когда оценят ваш микс, и пришлём «Микс дня». Без спама.</p>`}`);
        const btn = box.querySelector('#pushToggle');
        btn.onclick = async () => {
            btn.disabled = true;
            try { if (st.on) await disablePush(); else { await enablePush(); toast('Уведомления включены 🔔'); } }
            catch (e) { toast(e.message || 'Не удалось включить', 'err'); }
            render();
        };
        box.querySelectorAll('[data-pref]').forEach((c) => { c.onchange = () => setPrefs({ [c.dataset.pref]: c.checked }).catch(() => toast('Не удалось сохранить', 'err')); });
    };
    render();
}

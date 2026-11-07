/* Блок «Мои заведения» в профиле: список, создание/правка (ссылки, логотип), команда, меню миксов */
import { html, icon, setHTML, toast, sheet, cover, avatar } from './ui.js';
import {
    myVenues, getVenue, createVenue, updateVenue, archiveVenue,
    venueAddMix, venueRemoveMix, venueReorder, uploadVenueLogo, listMixes,
    venueStaff, venueAddStaff, venueRemoveStaff,
} from './api.js';
import { state } from './store.js';
import { compressImage } from './photo.js';
import { venueShareSheet } from './venueShare.js';

export async function venuesBlock(box) {
    const paint = async () => {
        let list = [];
        try { list = await myVenues(); } catch { setHTML(box, html`<div class="empty"><b>Не удалось загрузить</b></div>`); return; }
        list = list.filter((v) => !v.archived);
        setHTML(box, html`
          <div class="block__head"><h2 class="h2">Мои заведения</h2><button class="btn btn--sm btn--accent" id="vNew">${icon('plus')} Добавить</button></div>
          ${list.length ? html`<div class="rows">${list.map((v) => html`<div class="vcard">
              <div class="vcard__info">
                <div class="vcard__title">${v.name}</div>
                <div class="vcard__sub">/v/${v.slug}${v.verified ? ' · проверено' : ''}</div>
                <div class="vcard__meta">${v.mixes} в меню · ${v.role === 'owner' ? 'владелец' : 'сотрудник'}</div>
              </div>
              <div class="vcard__btns">
                <button class="btn btn--sm" data-menu="${v.id}">Меню</button>
                <button class="btn btn--sm btn--accent" data-qr="${v.id}">${icon('qr')} QR</button>
                ${v.role === 'owner' ? html`<button class="btn btn--sm" data-team="${v.id}">Команда</button>
                <button class="btn btn--sm btn--ghost" data-edit="${v.id}">${icon('edit')} Правка</button>` : ''}
              </div></div>`)}</div>`
            : html`<p class="muted small">Своё меню миксов и QR на стол для гостей. Создайте заведение — адрес /v/название.</p>`}`);
        const by = (id) => list.find((v) => v.id === id);
        box.querySelector('#vNew').onclick = () => venueForm(null, paint);
        box.querySelectorAll('[data-menu]').forEach((b) => { b.onclick = () => menuEditor(by(b.dataset.menu), paint); });
        box.querySelectorAll('[data-qr]').forEach((b) => { b.onclick = () => venueShareSheet(by(b.dataset.qr)); });
        box.querySelectorAll('[data-team]').forEach((b) => { b.onclick = () => teamSheet(by(b.dataset.team)); });
        box.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => venueForm(by(b.dataset.edit), paint); });
    };
    paint();
}

function venueForm(v, done) {
    let logoFile = null, logoUrl = '';
    const field = (id, label, val, extra = '') => html`<label class="field"><span class="muted small">${label}</span>
          <input class="input" id="${id}" value="${val || ''}" maxlength="200" autocapitalize="none" autocomplete="off" spellcheck="false" ${extra}></label>`;
    const s = sheet(html`<form class="nameform">
        <h2 class="h2">${v ? 'Заведение' : 'Новое заведение'}</h2>
        <label class="field"><span class="muted small">Адрес /v/… (латиница, цифры, - и _; 3–30)</span>
          <input class="input" id="vs" value="${v?.slug || ''}" maxlength="30" autocapitalize="none" autocomplete="off" spellcheck="false" placeholder="например, smoke-lounge"></label>
        <label class="field"><span class="muted small">Название</span>
          <input class="input" id="vn" value="${v?.name || ''}" maxlength="60" required></label>
        <label class="field"><span class="muted small">Город</span>
          <input class="input" id="vc" value="${v?.city || ''}" maxlength="40"></label>
        ${field('va', 'Адрес заведения: текст или ссылка на карту (до 200)', v?.address, 'autocomplete="street-address"')}
        <label class="field"><span class="muted small">Описание (до 500)</span>
          <textarea class="input" id="vd" rows="3" maxlength="500">${v?.description || ''}</textarea></label>
        ${field('vig', 'Instagram (необязательно)', v?.instagram, 'placeholder="@name или ссылка"')}
        ${field('vw', 'Сайт (необязательно)', v?.website, 'inputmode="url" placeholder="example.com"')}
        ${field('vfb', 'Facebook (необязательно)', v?.facebook, 'inputmode="url" placeholder="facebook.com/…"')}
        ${field('vtg', 'Telegram (необязательно)', v?.telegram, 'placeholder="@name или t.me/…"')}
        ${v ? html`<p class="muted small">Смена адреса /v/… или названия снимает отметку «проверено».</p>
          <div class="logoedit">
            <span class="logoedit__prev" id="vlPrev">${v.logo_url ? html`<img src="${v.logo_url}" alt="">` : html`<b>${(v.name || '?').slice(0, 1).toUpperCase()}</b>`}</span>
            <label class="btn" style="cursor:pointer">Логотип<input type="file" accept="image/*" id="vl" hidden></label>
          </div>
          <button class="btn btn--ghost btn--danger" type="button" id="vDel">Убрать заведение</button>` : ''}
        <button class="btn btn--accent btn--lg" type="submit">Сохранить</button>
      </form>`, { onClose: () => { if (logoUrl) URL.revokeObjectURL(logoUrl); } });
    const $ = (q) => s.body.querySelector(q);
    const vs = $('#vs');
    vs.addEventListener('input', () => { vs.value = vs.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''); });
    $('form').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            slug: vs.value.trim(), name: $('#vn').value.trim(), city: $('#vc').value.trim(), description: $('#vd').value.trim(),
            address: $('#va').value, instagram: $('#vig').value, website: $('#vw').value, facebook: $('#vfb').value, telegram: $('#vtg').value,
        };
        try {
            if (v) await updateVenue(v.id, data); else await createVenue(data);
            if (v && logoFile) await uploadVenueLogo(v.id, logoFile);
            s.close(); toast('Сохранено'); done();
        } catch (err) { toast(err.message || 'Не удалось сохранить', 'err'); }
    };
    // Логотип: превью сразу после выбора, загрузка — при «Сохранить»
    $('#vl')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0]; if (!file) return;
        try {
            logoFile = await compressImage(file);
            if (logoUrl) URL.revokeObjectURL(logoUrl);
            logoUrl = URL.createObjectURL(logoFile);
            $('#vlPrev').replaceChildren(Object.assign(new Image(), { src: logoUrl, alt: '' }));
        } catch (err) { logoFile = null; toast(err.message || 'Не удалось прочитать картинку', 'err'); }
    });
    $('#vDel')?.addEventListener('click', async () => {
        if (!confirm('Убрать заведение? Ссылка и QR перестанут работать.')) return;
        try { await archiveVenue(v.id); s.close(); toast('Заведение убрано'); done(); }
        catch (err) { toast(err.message || 'Не удалось', 'err'); }
    });
}

async function teamSheet(v) {
    const s = sheet(html`<form class="nameform">
        <h2 class="h2">Команда</h2>
        <p class="muted small nameform__sub">${v.name}</p>
        <div class="rows" id="tmList"><div class="row row--skel"><div class="skel"></div></div></div>
        <label class="field"><span class="muted small">Добавить по @нику (до 10 сотрудников)</span>
          <input class="input" id="tmh" placeholder="@ник" maxlength="40" autocapitalize="none" autocomplete="off" spellcheck="false"></label>
        <button class="btn btn--accent btn--lg" type="submit">Добавить</button>
      </form>`);
    const $ = (q) => s.body.querySelector(q);
    const paintList = (list) => {
        setHTML($('#tmList'), list.length ? list.map((m) => html`<div class="tmrow">
            ${avatar(m, 'avatar--sm')}
            <div class="tmrow__main"><div class="tmrow__name">${m.name || 'Без имени'}</div>
              <div class="tmrow__sub">${m.handle ? '@' + m.handle : 'без ника'} · ID ${String(m.user_id).slice(0, 8)}</div></div>
            <button class="tmrow__rm" type="button" data-rm="${m.user_id}" aria-label="Убрать сотрудника">${icon('x')}</button></div>`)
            : html`<p class="muted small">Сотрудников пока нет. Сотрудник правит меню и логотип, но не заведение и команду.</p>`);
        s.body.querySelectorAll('[data-rm]').forEach((b) => {
            b.onclick = async () => {
                if (!confirm('Убрать сотрудника? Заведение пропадёт у него.')) return;
                try { await venueRemoveStaff(v.id, b.dataset.rm); await reload(); toast('Сотрудник убран'); }
                catch (e) { toast(e.message || 'Не удалось', 'err'); }
            };
        });
    };
    const reload = async () => paintList(await venueStaff(v.id));
    $('form').onsubmit = async (e) => {
        e.preventDefault();
        const h = $('#tmh').value.trim();
        if (!h) return;
        try { await venueAddStaff(v.id, h); $('#tmh').value = ''; await reload(); toast('Сотрудник добавлен'); }
        catch (err) { toast(err.message || 'Не удалось добавить', 'err'); }
    };
    try { await reload(); } catch { setHTML($('#tmList'), html`<div class="empty"><b>Не удалось загрузить</b></div>`); }
}

async function menuEditor(v, done) {
    let items = [], mine = [];
    const s = sheet(html`<div class="nameform">
        <h2 class="h2">Меню</h2>
        <p class="muted small nameform__sub">${v.name}</p>
        <div class="rows" id="vmList"><div class="row row--skel"><div class="skel"></div></div></div>
        <h3 class="h3">Мои миксы</h3>
        <div class="rows" id="vmMine"></div>
        <h3 class="h3">Найти в каталоге</h3>
        <input class="input" id="vmq" placeholder="Название микса…" autocomplete="off">
        <div class="rows" id="vmRes"></div>
      </div>`, { onClose: done });
    const $ = (q) => s.body.querySelector(q);
    const have = () => new Set(items.map((m) => m.id));

    const addBtn = (m) => (have().has(m.id)
        ? html`<button class="btn btn--sm btn--ghost vm__add" disabled>В меню</button>`
        : html`<button class="btn btn--sm btn--accent vm__add" data-add="${m.id}" aria-label="Добавить">${icon('plus')}</button>`);

    const bindAdd = (root) => root.querySelectorAll('[data-add]').forEach((b) => {
        b.onclick = async () => {
            b.disabled = true;
            try { await venueAddMix(v.id, b.dataset.add); await reload(); }
            catch (e) { b.disabled = false; toast(e.message || 'Не удалось', 'err'); }
        };
    });

    const paintMine = () => {
        const list = mine.filter((m) => !have().has(m.id));
        setHTML($('#vmMine'), list.length ? list.map((m) => html`<div class="row vm__row">
            <div class="row__main"><div class="row__title vm__name">${m.name}</div></div>${addBtn(m)}</div>`)
            : html`<p class="muted small">${mine.length ? 'Все ваши миксы уже в меню' : 'У вас пока нет опубликованных миксов'}</p>`);
        bindAdd($('#vmMine'));
    };

    const paintList = () => {
        setHTML($('#vmList'), items.length ? items.map((m, i) => html`<div class="vmcard">
            <div class="vmcard__top">
              ${cover(m, 'vmcard__cover')}
              <div class="row__main"><div class="row__title vm__name">${m.name}</div>
                ${m.description ? html`<div class="vmcard__desc">${m.description}</div>` : ''}</div>
            </div>
            <div class="vmcard__btns">
              <button class="btn btn--sm btn--ghost" data-up="${i}" ${i === 0 ? 'disabled' : ''}>выше</button>
              <button class="btn btn--sm btn--ghost" data-down="${i}" ${i === items.length - 1 ? 'disabled' : ''}>ниже</button>
              <button class="btn btn--sm btn--ghost btn--danger" data-rm="${m.id}">удалить</button>
            </div></div>`) : html`<p class="muted small">Меню пустое — добавьте свои миксы или найдите в каталоге.</p>`);
        const move = async (i, d) => {
            const ids = items.map((m) => m.id); [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
            try { await venueReorder(v.id, ids); await reload(); } catch (e) { toast(e.message || 'Не удалось', 'err'); }
        };
        $('#vmList').querySelectorAll('[data-up]').forEach((b) => { b.onclick = () => move(+b.dataset.up, -1); });
        $('#vmList').querySelectorAll('[data-down]').forEach((b) => { b.onclick = () => move(+b.dataset.down, 1); });
        $('#vmList').querySelectorAll('[data-rm]').forEach((b) => {
            b.onclick = async () => { try { await venueRemoveMix(v.id, b.dataset.rm); await reload(); } catch (e) { toast(e.message || 'Не удалось', 'err'); } };
        });
    };

    const search = async () => {
        const q = $('#vmq').value.trim();
        if (q.length < 2) { setHTML($('#vmRes'), ''); return; }
        try {
            const found = await listMixes({ q, sort: 'popular', limit: 8 });
            setHTML($('#vmRes'), found.length ? found.map((m) => html`<div class="row vm__row">
                <div class="row__main"><div class="row__title vm__name vm__name--lg">${m.name}</div>
                  <div class="row__sub">${(m.tags || []).slice(0, 3).join(' · ')}</div></div>${addBtn(m)}</div>`) : html`<p class="muted small">Ничего не найдено</p>`);
            bindAdd($('#vmRes'));
        } catch { toast('Поиск не удался', 'err'); }
    };
    const reload = async () => {
        items = (await getVenue(v.slug))?.mixes || [];
        paintList(); paintMine();
        if ($('#vmq').value.trim().length >= 2) await search();
    };
    let timer = 0;
    $('#vmq').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(search, 250); });

    try { if (state.user?.id) mine = await listMixes({ author: state.user.id, sort: 'new', limit: 100 }); } catch { mine = []; }
    try { await reload(); } catch { setHTML($('#vmList'), html`<div class="empty"><b>Не удалось загрузить</b></div>`); }
}

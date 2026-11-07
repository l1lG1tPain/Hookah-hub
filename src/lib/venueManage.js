/* Блок «Мои заведения» в профиле: список, создание/правка, меню миксов (поиск, порядок, удаление), логотип */
import { html, icon, setHTML, toast, sheet } from './ui.js';
import {
    myVenues, getVenue, createVenue, updateVenue, archiveVenue,
    venueAddMix, venueRemoveMix, venueReorder, uploadVenueLogo, listMixes,
} from './api.js';
import { compressImage } from './photo.js';
import { venueShareSheet } from './venueShare.js';

export async function venuesBlock(box) {
    const paint = async () => {
        let list = [];
        try { list = await myVenues(); } catch { setHTML(box, html`<div class="empty"><b>Не удалось загрузить</b></div>`); return; }
        list = list.filter((v) => !v.archived);
        setHTML(box, html`
          <div class="block__head"><h2 class="h2">Мои заведения</h2><button class="btn btn--sm btn--accent" id="vNew">${icon('plus')} Добавить</button></div>
          ${list.length ? html`<div class="rows">${list.map((v) => html`<div class="row">
              <div class="row__main"><div class="row__title">${v.name}</div>
                <div class="row__sub">/v/${v.slug}${v.verified ? ' · проверено' : ''}</div>
                <div class="row__meta">${v.mixes} в меню · ${v.role === 'owner' ? 'владелец' : 'сотрудник'}</div></div>
              <div class="mypage__btns">
                <button class="btn btn--sm" data-menu="${v.id}">Меню</button>
                <button class="btn btn--sm btn--accent" data-qr="${v.id}">${icon('qr')}</button>
                ${v.role === 'owner' ? html`<button class="btn btn--sm btn--ghost" data-edit="${v.id}">${icon('edit')}</button>` : ''}
              </div></div>`)}</div>`
            : html`<p class="muted small">Своё меню миксов и QR на стол для гостей. Создайте заведение — адрес /v/название.</p>`}`);
        const by = (id) => list.find((v) => v.id === id);
        box.querySelector('#vNew').onclick = () => venueForm(null, paint);
        box.querySelectorAll('[data-menu]').forEach((b) => { b.onclick = () => menuEditor(by(b.dataset.menu), paint); });
        box.querySelectorAll('[data-qr]').forEach((b) => { b.onclick = () => venueShareSheet(by(b.dataset.qr)); });
        box.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => venueForm(by(b.dataset.edit), paint); });
    };
    paint();
}

function venueForm(v, done) {
    const s = sheet(html`<form class="nameform">
        <h2 class="h2">${v ? 'Заведение' : 'Новое заведение'}</h2>
        <label class="field"><span class="muted small">Адрес /v/… (латиница, цифры, - и _; 3–30)</span>
          <input class="input" id="vs" value="${v?.slug || ''}" maxlength="30" autocapitalize="none" autocomplete="off" spellcheck="false" placeholder="например, smoke-lounge"></label>
        <label class="field"><span class="muted small">Название</span>
          <input class="input" id="vn" value="${v?.name || ''}" maxlength="60" required></label>
        <label class="field"><span class="muted small">Город</span>
          <input class="input" id="vc" value="${v?.city || ''}" maxlength="40"></label>
        <label class="field"><span class="muted small">Описание (до 500)</span>
          <textarea class="input" id="vd" rows="3" maxlength="500">${v?.description || ''}</textarea></label>
        ${v ? html`<p class="muted small">Смена адреса или названия снимает отметку «проверено».</p>
          <label class="btn btn--lg" style="text-align:center;cursor:pointer">Логотип<input type="file" accept="image/*" id="vl" hidden></label>
          <button class="btn btn--ghost btn--danger" type="button" id="vDel">Убрать заведение</button>` : ''}
        <button class="btn btn--accent btn--lg" type="submit">Сохранить</button>
      </form>`);
    const $ = (q) => s.body.querySelector(q);
    const vs = $('#vs');
    vs.addEventListener('input', () => { vs.value = vs.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''); });
    $('form').onsubmit = async (e) => {
        e.preventDefault();
        const data = { slug: vs.value.trim(), name: $('#vn').value.trim(), city: $('#vc').value.trim(), description: $('#vd').value.trim() };
        try {
            if (v) await updateVenue(v.id, data); else await createVenue(data);
            s.close(); toast('Сохранено'); done();
        } catch (err) { toast(err.message || 'Не удалось сохранить', 'err'); }
    };
    $('#vl')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0]; if (!file) return;
        try { toast('Загружаем…'); await uploadVenueLogo(v.id, await compressImage(file)); s.close(); toast('Логотип обновлён'); done(); }
        catch (err) { toast(err.message || 'Не удалось загрузить', 'err'); }
    });
    $('#vDel')?.addEventListener('click', async () => {
        if (!confirm('Убрать заведение? Ссылка и QR перестанут работать.')) return;
        try { await archiveVenue(v.id); s.close(); toast('Заведение убрано'); done(); }
        catch (err) { toast(err.message || 'Не удалось', 'err'); }
    });
}

async function menuEditor(v, done) {
    let items = [];
    const s = sheet(html`<div class="nameform">
        <h2 class="h2">Меню · ${v.name}</h2>
        <div class="rows" id="vmList"><div class="row row--skel"><div class="skel"></div></div></div>
        <input class="input" id="vmq" placeholder="Найти микс в каталоге…" autocomplete="off">
        <div class="rows" id="vmRes"></div>
      </div>`, { onClose: done });
    const $ = (q) => s.body.querySelector(q);

    const reload = async () => { items = (await getVenue(v.slug))?.mixes || []; paintList(); };
    const paintList = () => {
        setHTML($('#vmList'), items.length ? items.map((m, i) => html`<div class="row">
            <div class="row__main"><div class="row__title">${m.name}</div></div>
            <div class="mypage__btns">
              <button class="btn btn--sm btn--ghost" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Выше">↑</button>
              <button class="btn btn--sm btn--ghost" data-down="${i}" ${i === items.length - 1 ? 'disabled' : ''} aria-label="Ниже">↓</button>
              <button class="btn btn--sm btn--ghost btn--danger" data-rm="${m.id}" aria-label="Убрать">✕</button>
            </div></div>`) : html`<p class="muted small">Меню пустое — найдите миксы ниже.</p>`);
        const move = async (i, d) => {
            const ids = items.map((m) => m.id); [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
            try { await venueReorder(v.id, ids); await reload(); } catch (e) { toast(e.message || 'Не удалось', 'err'); }
        };
        s.body.querySelectorAll('[data-up]').forEach((b) => { b.onclick = () => move(+b.dataset.up, -1); });
        s.body.querySelectorAll('[data-down]').forEach((b) => { b.onclick = () => move(+b.dataset.down, 1); });
        s.body.querySelectorAll('[data-rm]').forEach((b) => {
            b.onclick = async () => { try { await venueRemoveMix(v.id, b.dataset.rm); await reload(); } catch (e) { toast(e.message || 'Не удалось', 'err'); } };
        });
    };

    let timer = 0;
    $('#vmq').addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
            const q = $('#vmq').value.trim();
            if (q.length < 2) { setHTML($('#vmRes'), ''); return; }
            try {
                const have = new Set(items.map((m) => m.id));
                const found = (await listMixes({ q, sort: 'popular', limit: 8 })).filter((m) => !have.has(m.id));
                setHTML($('#vmRes'), found.length ? found.map((m) => html`<div class="row">
                    <div class="row__main"><div class="row__title">${m.name}</div><div class="row__sub">${(m.tags || []).slice(0, 3).join(' · ')}</div></div>
                    <button class="btn btn--sm btn--accent" data-add="${m.id}">${icon('plus')}</button></div>`) : html`<p class="muted small">Ничего не найдено</p>`);
                s.body.querySelectorAll('[data-add]').forEach((b) => {
                    b.onclick = async () => {
                        try { await venueAddMix(v.id, b.dataset.add); b.closest('.row').remove(); await reload(); }
                        catch (e) { toast(e.message || 'Не удалось', 'err'); }
                    };
                });
            } catch { toast('Поиск не удался', 'err'); }
        }, 250);
    });
    try { await reload(); } catch { setHTML($('#vmList'), html`<div class="empty"><b>Не удалось загрузить</b></div>`); }
}

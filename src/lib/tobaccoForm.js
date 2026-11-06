/* Шторка «Добавить табак»: бренд из списка или новый, название, линейка, вкус, описание, фото */
import { html, icon, setHTML, sheet, toast } from './ui.js';
import { listBrandsFull, createBrand, createTobacco, attachImage } from './api.js';
import { TASTES } from './tastes.js';
import { photoField, bindPhoto } from './photo.js';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9а-яё]/g, '');

export function openTobaccoSheet({ onCreated, name = '' } = {}) {
    const tags = new Set();
    let brands = [];
    const s = sheet(html`<form class="tform" novalidate>
        <h2 class="h2">Добавить табак</h2>
        <p class="muted small">Табак появится в общем каталоге. Если такой уже есть, мы покажем существующий.</p>
        <label class="field"><span class="field__label">Бренд</span>
          <input class="input" name="brand" maxlength="40" placeholder="Начните вводить: DarkSide, Tangiers…" autocomplete="off" required>
          <div class="tform__sug" id="sug"></div>
          <small class="tform__hint" id="brandHint"></small>
        </label>
        <label class="field"><span class="field__label">Название вкуса</span>
          <input class="input" name="name" maxlength="60" placeholder="Например, Lemon Pie" value="${name}" autocomplete="off" required></label>
        <label class="field"><span class="field__label">Линейка <small class="muted">необязательно</small></span>
          <input class="input" name="line" maxlength="40" placeholder="Например, Core" autocomplete="off"></label>
        <div class="field"><span class="field__label">Вкус <small class="muted">до 4</small></span><div class="chips chips--wrap" id="ttags"></div></div>
        <label class="field"><span class="field__label">Описание <small class="muted">необязательно</small></span>
          <textarea class="input input--area" name="description" maxlength="400" rows="3" placeholder="Какие ноты, насколько крепкий, с чем миксовать"></textarea></label>
        ${photoField('Добавить фото банки')}
        <button class="btn btn--accent btn--lg" type="submit" id="tsubmit">Добавить в каталог</button>
      </form>`);
    const root = s.body, $ = (q) => root.querySelector(q);
    const photo = bindPhoto(root);
    const brandInput = $('[name=brand]');

    const paintTags = () => setHTML($('#ttags'), TASTES.map((t) => html`<button type="button" class="chip ${tags.has(t) ? 'on' : ''}" data-tag="${t}">${t}</button>`));
    const paintSug = () => {
        const q = norm(brandInput.value);
        const exact = brands.find((b) => norm(b.name) === q);
        const list = q ? brands.filter((b) => norm(b.name).includes(q) && b !== exact).slice(0, 6) : brands.slice(0, 0);
        setHTML($('#sug'), list.map((b) => html`<button type="button" class="chip chip--brand" data-brand="${b.name}">${b.name}</button>`));
        $('#brandHint').textContent = !q ? '' : exact ? '✓ Бренд есть в каталоге' : 'Такого бренда нет — он будет создан';
    };
    root.addEventListener('click', (e) => {
        const t = e.target.closest('[data-tag]'), b = e.target.closest('[data-brand]');
        if (t) { const v = t.dataset.tag; if (tags.has(v)) tags.delete(v); else if (tags.size < 4) tags.add(v); else toast('Не больше 4 вкусов'); paintTags(); }
        if (b) { brandInput.value = b.dataset.brand; paintSug(); $('[name=name]').focus(); }
    });
    brandInput.addEventListener('input', paintSug);
    paintTags();
    listBrandsFull().then((b) => { brands = b; paintSug(); }).catch(() => {});

    $('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const brandName = String(f.get('brand') || '').trim(), tname = String(f.get('name') || '').trim();
        if (brandName.length < 2) { toast('Укажите бренд'); brandInput.focus(); return; }
        if (tname.length < 2) { toast('Укажите название'); return; }
        const btn = $('#tsubmit'); btn.disabled = true; btn.textContent = 'Добавляем…';
        try {
            const known = brands.find((b) => norm(b.name) === norm(brandName));
            const brandId = known ? known.id : await createBrand(brandName);
            const id = await createTobacco({ brandId, name: tname, line: String(f.get('line') || '').trim(), tags: [...tags], description: String(f.get('description') || '').trim() });
            const img = photo.get();
            if (img) { try { await attachImage('tobacco', id, img); } catch (err) { toast(err.message, 'err'); } }
            s.close();
            toast('Табак добавлен в каталог 🎉');
            onCreated?.({ id, name: tname, brand_name: known?.name || brandName });
        } catch (err) {
            toast(err?.message || 'Не удалось добавить', 'err');
            btn.disabled = false; btn.textContent = 'Добавить в каталог';
        }
    });
    setTimeout(() => brandInput.focus(), 100);
}

import { html, icon, setHTML, toast, sheet, toNode, debounce, esc } from '../lib/ui.js';
import { listAllTobaccos, createMix, attachImage } from '../lib/api.js';
import { DEMO } from '../lib/supabase.js';
import { photoField, bindPhoto } from '../lib/photo.js';
import { openTobaccoSheet } from '../lib/tobaccoForm.js';
import { state, subscribe, refreshUser } from '../lib/store.js';
import { TASTES } from '../lib/tastes.js';

const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];
const MAX = 6;
let catalog = null;

export function CreatePage(el) {
    let mode = '';
    const paint = () => {
        const next = !state.ready ? 'loading' : state.user ? 'form' : 'guest';
        if (next === mode) return;
        mode = next;
        if (next === 'loading') setHTML(el, html`<div class="profile"><div class="panel skel" style="height:300px"></div></div>`);
        else if (next === 'guest') setHTML(el, html`<div class="empty empty--page"><img src="/icons/192.png" alt="">
            <b>Войдите, чтобы создать микс</b><span>Ваши миксы будут подписаны вашим именем, а другие смогут их оценить</span>
            <a class="btn btn--accent" href="#/profile">Войти</a></div>`);
        else form(el);
    };
    paint();
    return subscribe(paint);
}

function form(el) {
    const st = { tags: new Set(), rows: [{ t: null, p: 50 }, { t: null, p: 50 }] };

    setHTML(el, html`<div class="create">
      <section class="page-head">
        <p class="eyebrow">Конструктор</p>
        <h1 class="display display--sm">Свой <em>микс</em></h1>
        <p class="lead">Соберите микс из табаков каталога — он появится в общей ленте с вашим именем.</p>
      </section>

      <form id="f" class="create__form" novalidate>
        <label class="field">
          <span class="field__label">Название</span>
          <input class="input" name="title" maxlength="60" placeholder="Например, «Ягодный лимонад»" required autocomplete="off">
        </label>

        <div class="field">
          <span class="field__label">Состав <small class="muted" id="sum"></small></span>
          <div class="stack stack--lg" id="stack"></div>
          <div class="rows-edit" id="rows"></div>
          <div class="create__row-actions">
            <button type="button" class="btn btn--sm" id="add">${icon('plus')} Добавить табак</button>
            <button type="button" class="btn btn--sm btn--ghost" id="even">Поровну</button>
          </div>
        </div>

        <div class="field">
          <span class="field__label">Вкус <small class="muted">до 4</small></span>
          <div class="chips chips--wrap" id="tags"></div>
        </div>

        <label class="field">
          <span class="field__label">Описание <small class="muted">необязательно</small></span>
          <textarea class="input input--area" name="description" maxlength="1000" rows="4" placeholder="Как забивать, чем хорош, с чем пить…"></textarea>
        </label>

        ${DEMO ? '' : photoField('Добавить фото микса')}

        <button class="btn btn--accent btn--lg" type="submit" id="submit">Опубликовать микс</button>
      </form>
    </div>`);

    const $ = (s) => el.querySelector(s);
    const photo = DEMO ? null : bindPhoto(el);
    const sum = () => st.rows.reduce((a, r) => a + (Number(r.p) || 0), 0);

    function paintRows() {
        setHTML($('#rows'), st.rows.map((r, i) => html`
          <div class="rowedit">
            <span class="ing__dot" style="background:${COLORS[i % 6]}"></span>
            <button type="button" class="rowedit__pick ${r.t ? '' : 'empty'}" data-pick="${i}">
              ${r.t ? html`<b>${r.t.name}</b>${r.t.brand_name ? html`<small>${r.t.brand_name}</small>` : html`<small>свой табак</small>`}`
                    : html`<span>Выбрать табак</span>`}
            </button>
            <div class="pct">
              <button type="button" data-dec="${i}" aria-label="Меньше">−</button>
              <input inputmode="numeric" data-pct="${i}" value="${r.p}" aria-label="Процент">
              <button type="button" data-inc="${i}" aria-label="Больше">+</button>
            </div>
            <button type="button" class="icon-btn rowedit__x" data-del="${i}" aria-label="Убрать" ${st.rows.length < 2 ? 'disabled' : ''}>${icon('x')}</button>
          </div>`));
        $('#add').disabled = st.rows.length >= MAX;
        paintSum();
    }
    function paintSum() {
        const s = sum();
        const box = $('#sum');
        box.textContent = s === 100 ? '· 100% ✓' : s < 100 ? `· ${s}% — добавьте ещё ${100 - s}%` : `· ${s}% — лишние ${s - 100}%`;
        box.className = s === 100 ? 'ok' : 'warn';
        setHTML($('#stack'), st.rows.map((r, i) => html`<i style="flex:${Math.max(Number(r.p) || 0, 0.001)};background:${COLORS[i % 6]};opacity:${r.t ? 1 : .35}"></i>`));
    }
    function paintTags() {
        setHTML($('#tags'), TASTES.map((t) => html`<button type="button" class="chip ${st.tags.has(t) ? 'on' : ''}" data-tag="${t}">${t}</button>`));
    }

    el.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const d = b.dataset;
        if (d.pick != null) return pickTobacco((t) => { st.rows[+d.pick].t = t; paintRows(); });
        if (d.del != null) { st.rows.splice(+d.del, 1); paintRows(); }
        else if (d.inc != null) { st.rows[+d.inc].p = Math.min(100, (+st.rows[+d.inc].p || 0) + 5); paintRows(); }
        else if (d.dec != null) { st.rows[+d.dec].p = Math.max(5, (+st.rows[+d.dec].p || 0) - 5); paintRows(); }
        else if (d.tag) {
            if (st.tags.has(d.tag)) st.tags.delete(d.tag);
            else if (st.tags.size < 4) st.tags.add(d.tag);
            else toast('Не больше 4 вкусов');
            paintTags();
        } else if (b.id === 'add' && st.rows.length < MAX) {
            st.rows.push({ t: null, p: Math.max(5, 100 - sum()) });
            paintRows();
            pickTobacco((t) => { st.rows[st.rows.length - 1].t = t; paintRows(); });
        } else if (b.id === 'even') {
            const n = st.rows.length, base = Math.floor(100 / n / 5) * 5;
            st.rows.forEach((r, i) => { r.p = base; });
            st.rows[0].p += 100 - base * n;
            paintRows();
        }
    });
    el.addEventListener('input', (e) => {
        const i = e.target.dataset.pct;
        if (i == null) return;
        st.rows[+i].p = Math.max(0, Math.min(100, parseInt(e.target.value.replace(/\D/g, ''), 10) || 0));
        paintSum();
    });

    $('#f').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const title = String(fd.get('title') || '').trim();
        if (title.length < 2) { toast('Введите название'); $('[name=title]').focus(); return; }
        if (st.rows.some((r) => !r.t)) { toast('Выберите табак в каждой строке'); return; }
        if (sum() !== 100) { toast('Сумма процентов должна быть 100'); return; }
        const ids = st.rows.filter((r) => r.t.id).map((r) => r.t.id);
        if (new Set(ids).size !== ids.length) { toast('Один табак добавлен дважды'); return; }

        const btn = $('#submit');
        btn.disabled = true; btn.textContent = 'Публикуем…';
        try {
            const id = await createMix({
                title,
                description: String(fd.get('description') || '').trim(),
                tags: [...st.tags],
                ingredients: st.rows.map((r) => (r.t.id ? { tobacco_id: r.t.id, percent: +r.p } : { custom_title: r.t.name, percent: +r.p })),
            });
            const img = photo?.get();
            if (img) { try { await attachImage('mix', id, img); } catch (er) { toast(er.message || 'Фото не загрузилось', 'err'); } }
            toast('Микс опубликован 🎉');
            refreshUser();
            location.hash = `#/mix?id=${encodeURIComponent(id)}`;
        } catch (err) {
            toast(err?.message || 'Не удалось сохранить', 'err');
            btn.disabled = false; btn.textContent = 'Опубликовать микс';
        }
    });

    paintRows();
    paintTags();
    if (!catalog) listAllTobaccos().then((c) => { catalog = c; }).catch(() => { catalog = []; });
}

/* Выбор табака: поиск по каталогу + «свой табак» */
function pickTobacco(onPick) {
    const s = sheet(html`<div class="picker">
        <h2 class="h2">Выберите табак</h2>
        <label class="search search--sm">${icon('search')}<input id="pq" type="search" placeholder="Название или бренд" autocomplete="off"></label>
        <div class="picker__list" id="pl"><div class="muted small">Загрузка…</div></div>
      </div>`);
    const input = s.body.querySelector('#pq');
    const list = s.body.querySelector('#pl');

    const render = async () => {
        if (!catalog) { try { catalog = await listAllTobaccos(); } catch { catalog = []; } }
        const q = input.value.trim().toLowerCase();
        const found = catalog.filter((t) => !q || t.name.toLowerCase().includes(q) || t.brand_name.toLowerCase().includes(q)).slice(0, 80);
        const groups = new Map();
        found.forEach((t) => { const b = t.brand_name || 'Другое'; if (!groups.has(b)) groups.set(b, []); groups.get(b).push(t); });
        setHTML(list, html`
          ${[...groups].map(([b, ts]) => html`<div class="picker__group"><div class="picker__brand">${b}</div>
            ${ts.map((t) => html`<button type="button" class="picker__item" data-id="${t.id}">${t.name}</button>`)}</div>`)}
          ${q.length >= 2 ? html`<button type="button" class="picker__custom" data-custom="1">${icon('plus')} Добавить «${input.value.trim()}» как свой табак</button>` : ''}
          ${!found.length && q.length < 2 ? html`<div class="muted small">Ничего не нашли</div>` : ''}
          <button type="button" class="picker__custom picker__custom--new" data-new="1">${icon('plus')} Нет в каталоге? Добавить табак и бренд</button>`);
    };

    list.addEventListener('click', (e) => {
        const it = e.target.closest('[data-id]');
        if (it) { onPick(catalog.find((t) => String(t.id) === it.dataset.id)); s.close(); return; }
        if (e.target.closest('[data-new]')) {
            const name = input.value.trim();
            s.close();
            openTobaccoSheet({ name, onCreated: (t) => { catalog?.push(t); onPick(t); } });
            return;
        }
        if (e.target.closest('[data-custom]')) {
            onPick({ id: null, name: input.value.trim().slice(0, 60), brand_name: '' });
            s.close();
        }
    });
    input.addEventListener('input', debounce(render, 120));
    render();
    setTimeout(() => input.focus(), 80);
}

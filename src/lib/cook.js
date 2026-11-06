/* «Забить»: граммовка по процентам + шаги с таймерами */
import { html, icon, setHTML, sheet, toast } from './ui.js';

const BOWLS = [15, 18, 20, 25];
const STEPS = [
    { t: 'Забейте чашу', d: 'Слоями и не утрамбовывая: воздух должен свободно проходить. Не доходите до края примерно на 2–3 мм.' },
    { t: 'Закройте фольгой или колпаком', d: 'Натяните ровно, без складок. Для фольги проколите 10–15 отверстий, ближе к центру.' },
    { t: 'Разогрейте угли', d: 'Три угля до серого налёта, не бросайте раскалённые в чашу сразу.', timer: 7 * 60, label: 'Угли' },
    { t: 'Дайте чаше прогреться', d: 'Положите угли и подождите перед первой затяжкой, затем начните мягко, без резких вдохов.', timer: 4 * 60, label: 'Прогрев' },
    { t: 'Сессия', d: 'Обычно 45–60 минут. Через 25–30 минут проверьте угли, при необходимости переверните или замените, чтобы не пересушить табак.', timer: 55 * 60, label: 'Сессия' },
];
const fmt = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
const gram = (v) => (Math.round(v * 2) / 2).toString().replace('.', ',');

export function openCook(mix) {
    let bowl = 20, timer = null, tick = null, lock = null;
    const stop = () => { clearInterval(tick); tick = timer = null; lock?.release?.().catch(() => {}); lock = null; };
    const s = sheet(html`<div class="cook"></div>`, { onClose: stop });
    const root = s.body.querySelector('.cook');

    const ing = (mix.ingredients || []);
    function paint() {
        setHTML(root, html`
          <h2 class="h2">Забить «${mix.name}»</h2>
          <div class="cook__bowl"><span class="muted small">Чаша</span>
            ${BOWLS.map((g) => html`<button class="chip ${g === bowl ? 'on' : ''}" data-bowl="${g}">${g} г</button>`)}</div>
          ${ing.length ? html`<ul class="cook__ing">${ing.map((x) => html`<li><span>${x.tobacco || x.custom_title}${x.brand ? html`<small> ${x.brand}</small>` : ''}</span>
            <b>${gram((bowl * x.percent) / 100)} г</b></li>`)}</ul>` : ''}
          <div class="cook__timer" id="ct" ${timer ? '' : 'hidden'}><span id="cl">${timer?.label || ''}</span><b id="cv">${timer ? fmt(timer.left) : ''}</b>
            <button class="btn btn--sm btn--ghost" data-stop>Стоп</button></div>
          <ol class="cook__steps">${STEPS.map((st, i) => html`<li><div><b>${st.t}</b><p class="muted small">${st.d}</p></div>
            ${st.timer ? html`<button class="btn btn--sm" data-timer="${i}">${icon('flame')} ${Math.round(st.timer / 60)} мин</button>` : ''}</li>`)}</ol>
          <p class="muted small">Экран не погаснет, пока идёт таймер. Курение вредит здоровью.</p>`);
    }
    async function start(i) {
        stop();
        const st = STEPS[i];
        timer = { label: st.label, end: Date.now() + st.timer * 1000, left: st.timer };
        try { lock = await navigator.wakeLock?.request('screen'); } catch { /* не критично */ }
        paint();
        tick = setInterval(() => {
            timer.left = Math.max(0, Math.round((timer.end - Date.now()) / 1000));
            const v = root.querySelector('#cv'); if (v) v.textContent = fmt(timer.left);
            if (!timer.left) {
                const label = timer.label; stop(); paint();
                try { navigator.vibrate?.([200, 100, 200]); } catch {}
                toast(`${label}: время вышло ⏰`);
            }
        }, 500);
    }
    root.addEventListener('click', (e) => {
        const b = e.target.closest('[data-bowl]'), t = e.target.closest('[data-timer]');
        if (b) { bowl = +b.dataset.bowl; paint(); }
        else if (t) start(+t.dataset.timer);
        else if (e.target.closest('[data-stop]')) { stop(); paint(); }
    });
    paint();
}

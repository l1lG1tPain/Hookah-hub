// src/pages/mix/MixView.js
import { el } from '../../utils/dom.js';
import { getCurrentUser } from '../../app/state.js';

function colorFor(key){
    return { 5:'green', 4:'orange', 3:'gold', 2:'brown', 1:'red' }[key] || 'black';
}
function ratingColors(counts){
    const total = Object.values(counts).reduce((a,b)=>a+b,0);
    if (!total) return {};
    const perc = Object.fromEntries(Object.entries(counts).map(([k,v]) => [k, Math.round(100*v/total)]));
    const values = Object.values(perc);
    const allEq = values.every(v => v === values[0]);
    if (allEq) return {};
    const max = Math.max(...values);
    const leaders = Object.entries(perc).filter(([,p]) => p === max).map(([k])=>k);
    if (leaders.length === 2 && max === 50) return Object.fromEntries(leaders.map(k=>[k, colorFor(k)]));
    return Object.fromEntries(leaders.map(k=>[k, colorFor(k)]));
}

export function MixView(){
    const root = el('div', { class:'page mix' });
    const params = new URLSearchParams((location.hash.split('?')[1]||''));
    const id = params.get('id');

    root.innerHTML = `
    <header class="topbar">
      <button id="back">←</button>
      <h1>Микс</h1>
      <button id="favBtn" title="В избранное">🤍</button>
    </header>
    <section class="content">
      <div id="hero"></div>
      <div id="ratings" style="display:flex; gap:8px; padding:12px 0; flex-wrap:wrap;"></div>
      <div id="tags"></div>
      <div id="ingredients"></div>
      <h3>Описание</h3>
      <p id="desc"></p>
      <div class="info muted" style="margin-top:8px;">Вы можете забить сами или поделиться этим миксом с кальянщиком. После дегустации не забудьте поставить оценку.</div>
      <p><button id="share">Поделиться</button></p>
    </section>
    <footer class="navbar">
      <a href="#/">Главная</a>
      <a href="#/favorites">Избранное</a>
      <a href="#/profile">Профиль</a>
    </footer>
  `;

    root.querySelector('#back').onclick = () => history.back();

    let mix = null;
    let favored = false;

    function paintFav(){
        root.querySelector('#favBtn').textContent = favored ? '❤️' : '🤍';
    }

    async function checkFav(){
        const user = getCurrentUser();
        if (!user) return;
        try{
            const r = await fetch('/api/favorites-list?tab=mixes', { headers: { 'x-tg-id': String(user.tg_id) } });
            const j = await r.json();
            if (j?.ok && Array.isArray(j.items)) favored = j.items.some(x => x.id === id);
        }catch{}
        paintFav();
    }

    async function load(){
        const r = await fetch(`/api/mix-get?id=${encodeURIComponent(id)}`);
        const data = await r.json();
        if (!data?.ok) { root.querySelector('#hero').textContent = 'Ошибка'; return; }

        mix = data.mix;

        // hero
        root.querySelector('#hero').innerHTML = `
      <img src="${mix.cover_url || 'https://placehold.co/1200x600?text=Hookah+Hub'}" style="width:100%; border-radius:12px;">
      <h2>${mix.name}</h2>
    `;

        // tags
        const tags = mix.tags || [];
        root.querySelector('#tags').innerHTML = tags.length
            ? `<div class="card__tags" style="padding:8px 0;">${tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div>`
            : '';

        // ingredients
        const ing = mix.ingredients || [];
        root.querySelector('#ingredients').innerHTML = ing.length ? `
      <h3>Состав</h3>
      <div style="display:grid; grid-template-columns:1fr auto; gap:8px;">
        ${ing.map(x=>`
          <div>${x.brand ? x.brand + ' ' : ''}${x.tobacco}</div>
          <div>${x.percent}%</div>
        `).join('')}
      </div>
    ` : '';

        // description
        root.querySelector('#desc').textContent = mix.description || 'Подробного описания нет';

        // ratings chips — поддерживаем оба формата (score5..score1 ИЛИ excellent..notgood)
        const rAgg = mix.ratings || {};
        const counts = {
            5: (rAgg.score5 ?? rAgg.excellent) || 0,
            4: (rAgg.score4 ?? rAgg.good) || 0,
            3: (rAgg.score3 ?? rAgg.ok) || 0,
            2: (rAgg.score2 ?? rAgg.bad) || 0,
            1: (rAgg.score1 ?? rAgg.notgood) || 0,
        };
        const colors = ratingColors(counts);
        const entries = [[5,'Отлично','💯'],[4,'Хорошо','🔥'],[3,'Пойдёт','😎'],[2,'Плохо','🙂'],[1,'Не очень','😐']];
        const total = Object.values(counts).reduce((a,b)=>a+b,0);

        root.querySelector('#ratings').innerHTML = entries.map(([k,label,emoji]) => {
            const cnt = counts[k] || 0;
            const style = (total && colors[k]) ? `style="color:${colors[k]};"` : '';
            return `<button class="rate" data-score="${k}">${emoji} ${label} ${cnt ? `<span ${style}>${cnt}</span>` : ''}</button>`;
        }).join('');

        // rate click
        root.querySelector('#ratings').onclick = async (e) => {
            const btn = e.target.closest('.rate'); if (!btn) return;
            const user = getCurrentUser(); if (!user) return alert('Войдите для оценки');
            const score = Number(btn.dataset.score);
            await fetch('/api/mixes-rate', {
                method: 'POST',
                headers: { 'content-type':'application/json', 'x-tg-id': String(user.tg_id) },
                body: JSON.stringify({ mix_id: id, score })
            });
            await load(); // обновим счётчики
        };

        // share
        root.querySelector('#share').onclick = async () => {
            const ing = mix.ingredients || [];
            const text =
                `Hookah Hub — Микс: «${mix.name}»\n` +
                `Вкусовые теги: ${(mix.tags || []).join(', ') || '—'}\n` +
                (ing.length
                    ? `Состав:\n${ing.map(x =>
                        `• ${(x.brand ? x.brand + ' ' : '')}${x.tobacco || x.custom_title || '—'} — ${x.percent}%`
                    ).join('\n')}\n`
                    : '') +
                `Описание: ${mix.description || '—'}\n\n` +
                `Попробуй и отметь оценку 😉`;

            if (navigator.share) { try { await navigator.share({ text }); } catch {} }
            else { await navigator.clipboard.writeText(text); alert('Скопировано'); }
        };

        // fav toggle (сердечко)
        root.querySelector('#favBtn').onclick = async () => {
            const user = getCurrentUser();
            if (!user) return alert('Войдите, чтобы добавлять в избранное');
            const rr = await fetch('/api/favorites-toggle', {
                method: 'POST',
                headers: { 'content-type':'application/json', 'x-tg-id': String(user.tg_id) },
                body: JSON.stringify({ item_type: 'mix', item_id: id })
            });
            const jj = await rr.json();
            if (jj?.ok) { favored = jj.favored; paintFav(); }
        };

        await checkFav();
    }

    load();
    return root;
}

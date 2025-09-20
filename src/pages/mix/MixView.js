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
    <header class="topbar"><button id="back">←</button><h1>Микс</h1><button id="favBtn">★</button></header>
    <section class="content">
      <div id="hero"></div>
      <div id="ratings" style="display:flex; gap:8px; padding:12px 0;"></div>
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

    async function load(){
        const r = await fetch(`/api/mix-get?id=${encodeURIComponent(id)}`);
        const payload = await r.json();
        if (!payload?.ok || !payload.mix) {
            root.querySelector('#hero').textContent = 'Ошибка';
            return;
        }

        const mix = payload.mix;

        // HERO + название
        root.querySelector('#hero').innerHTML = `
      <img src="${mix.cover_url || 'https://placehold.co/1200x600?text=Hookah+Hub'}" style="width:100%; border-radius:12px;">
      <h2>${mix.name}</h2>
    `;

        // Теги
        const tags = mix.tags || [];
        root.querySelector('#tags').innerHTML = tags.length
            ? `<div class="card__tags" style="padding:8px 0;">${tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div>`
            : '';

        // Состав (делаем "лейбл": custom_title || 'brand tobacco')
        const ing = (mix.ingredients || []).map(x => ({
            ...x,
            label: x.custom_title || [x.brand, x.tobacco].filter(Boolean).join(' ')
        }));
        root.querySelector('#ingredients').innerHTML = ing.length ? `
      <h3>Состав</h3>
      <div style="display:grid; grid-template-columns:1fr auto; gap:8px;">
        ${ing.map(x=>`
          <div>${x.label || '—'}</div>
          <div>${x.percent}%</div>
        `).join('')}
      </div>
    ` : '';

        // Описание
        root.querySelector('#desc').textContent = mix.description || 'Подробного описания нет';

        // ЧИПСЫ ОЦЕНОК (рейтинги теперь внутри mix.ratings)
        const ratings = mix.ratings || {};
        const counts = {
            5: ratings.excellent || 0,
            4: ratings.good || 0,
            3: ratings.ok || 0,
            2: ratings.bad || 0,
            1: ratings.notgood || 0,
        };
        const colors = ratingColors(counts);
        const entries = [
            [5,'Отлично','💯'],
            [4,'Хорошо','🔥'],
            [3,'Пойдёт','😎'],
            [2,'Плохо','🙂'],
            [1,'Не очень','😐']
        ];
        const total = Object.values(counts).reduce((a,b)=>a+b,0);

        root.querySelector('#ratings').innerHTML = entries.map(([k,label,emoji]) => {
            const cnt = counts[k] || 0;
            const style = (total && colors[k]) ? `style="color:${colors[k]};"` : '';
            return `<button class="rate" data-score="${k}">${emoji} ${label} ${cnt ? `<span ${style}>${cnt}</span>` : ''}</button>`;
        }).join('');

        // Голосование
        root.querySelector('#ratings').onclick = async (e) => {
            const btn = e.target.closest('.rate'); if (!btn) return;
            const user = getCurrentUser(); if (!user) return alert('Войдите для оценки');
            const score = Number(btn.dataset.score);
            await fetch('/api/mixes-rate', {
                method: 'POST',
                headers: { 'content-type':'application/json', 'x-tg-id': String(user.tg_id) },
                body: JSON.stringify({ mix_id: id, score })
            });
            await load(); // перезагрузим счётчики
        };

        // Поделиться (используем x.label)
        root.querySelector('#share').onclick = async () => {
            const text =
                `Hookah Hub — Микс: «${mix.name}»\n` +
                `Вкусовые теги: ${(mix.tags || []).join(', ') || '—'}\n` +
                (ing.length
                    ? `Состав:\n${ing.map(x => `• ${x.label || '—'} — ${x.percent}%`).join('\n')}\n`
                    : '') +
                `Описание: ${mix.description || '—'}\n\n` +
                `Попробуй и не забудь поставить оценку 😉`;

            if (navigator.share) {
                try { await navigator.share({ text }); }
                catch (e) { console.warn('Share cancelled', e); }
            } else {
                await navigator.clipboard.writeText(text);
                alert('Скопировано');
            }
        };
    }

    load();
    return root;
}

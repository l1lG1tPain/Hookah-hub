// src/pages/tobacco/TobaccoView.js
import { el } from '../../utils/dom.js';
import { getCurrentUser } from '../../app/state.js';

function colorFor(k){ return ({5:'green',4:'orange',3:'gold',2:'brown',1:'red'})[k] || 'black'; }
function ratingColors(counts){
    const total = Object.values(counts).reduce((a,b)=>a+b,0);
    if (!total) return {};
    const perc = Object.fromEntries(Object.entries(counts).map(([k,v])=>[k, Math.round(100*v/total)]));
    const max = Math.max(...Object.values(perc));
    const leaders = Object.entries(perc).filter(([,p])=>p===max).map(([k])=>k);
    return Object.fromEntries(leaders.map(k=>[k, colorFor(+k)]));
}

export function TobaccoView(){
    const root = el('div', { class:'page tobacco' });
    const params = new URLSearchParams((location.hash.split('?')[1]||''));
    const id = params.get('id');

    root.innerHTML = `
  <header class="topbar">
    <button id="back">←</button>
    <h1>Табак</h1>
    <button id="favBtn" class="fav-btn" title="В избранное"><span>🤍</span></button>
  </header>
  <section class="content">
    <div id="hero"></div>
    <div id="ratings" style="display:flex; gap:8px; padding:12px 0;"></div>
    <div id="meta"></div>
    <div id="tags"></div>
    <div class="info muted" style="margin-top:8px;">Оцените табак и добавьте в избранное, чтобы не потерять.</div>
    <p><button id="share">Поделиться</button></p>
  </section>
  <footer class="navbar">
    <a href="#/">Главная</a>
    <a href="#/favorites">Избранное</a>
    <a href="#/profile">Профиль</a>
  </footer>
  `;

    // локальный стиль для сердечка
    const style = document.createElement('style');
    style.textContent = `
    .fav-btn{
      width:42px; height:42px; border-radius:999px; border:1px solid var(--border);
      background:rgba(255,255,255,.85); display:flex; align-items:center; justify-content:center;
    }
    .fav-btn span{ font-size:18px; }
    .fav-btn.active{ background:#ffdee4; border-color:#ff99ad; }
  `;
    document.head.appendChild(style);

    root.querySelector('#back').onclick = () => history.back();

    let tobacco = null;
    let favored = false;

    function paintFav(){
        const btn = root.querySelector('#favBtn');
        btn.classList.toggle('active', favored);
        btn.querySelector('span').textContent = favored ? '❤️' : '🤍';
    }

    async function checkFav(){
        const user = getCurrentUser(); if (!user) return;
        try{
            const r = await fetch('/api/favorites-list?tab=tobaccos', { headers: { 'x-tg-id': String(user.tg_id) } });
            const j = await r.json();
            if (j?.ok) favored = j.items.some(x => x.id === id);
        }catch{}
        paintFav();
    }

    async function load(){
        const r = await fetch(`/api/tobacco-get?id=${encodeURIComponent(id)}`);
        if (!r.ok){ root.querySelector('#hero').textContent = 'Ошибка'; return; }
        tobacco = await r.json();

        root.querySelector('#hero').innerHTML = `
      <img src="${tobacco.cover_url || 'https://placehold.co/1200x600?text=Hookah+Hub'}" style="width:100%; border-radius:12px;">
      <h2>${tobacco.name}</h2>
    `;

        root.querySelector('#meta').innerHTML = `
      <div class="muted" style="margin-top:6px;">Бренд: <strong>${tobacco.brand_name || '—'}</strong></div>
    `;

        const tags = tobacco.tags || [];
        root.querySelector('#tags').innerHTML = tags.length
            ? `<div class="card__tags" style="padding:8px 0;">${tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div>` : '';

        // Рейтинги
        const rts = tobacco.ratings || {};
        const counts = {
            5: rts.excellent || 0,
            4: rts.good || 0,
            3: rts.ok || 0,
            2: rts.bad || 0,
            1: rts.notgood || 0,
        };
        const colors = ratingColors(counts);
        const entries = [[5,'Отлично','💯'],[4,'Хорошо','🔥'],[3,'Пойдёт','😎'],[2,'Плохо','🙂'],[1,'Не очень','😐']];
        const total = Object.values(counts).reduce((a,b)=>a+b,0);

        root.querySelector('#ratings').innerHTML = entries.map(([k,label,emoji])=>{
            const cnt = counts[k] || 0;
            const style = (total && colors[k]) ? `style="color:${colors[k]};"` : '';
            return `<button class="rate" data-score="${k}">${emoji} ${label} ${cnt ? `<span ${style}>${cnt}</span>`:''}</button>`;
        }).join('');

        // Клик по оценке
        root.querySelector('#ratings').onclick = async (e)=>{
            const btn = e.target.closest('.rate'); if (!btn) return;
            const user = getCurrentUser(); if (!user) return alert('Войдите для оценки');
            const map = {5:'excellent',4:'good',3:'ok',2:'bad',1:'notgood'};
            const score = map[Number(btn.dataset.score)];
            await fetch('/api/tobaccos-rate', {
                method:'POST',
                headers:{ 'content-type':'application/json', 'x-tg-id': String(user.tg_id) },
                body: JSON.stringify({ tobacco_id: id, score })
            });
            await load(); // обновим счётчики
        };

        // share
        root.querySelector('#share').onclick = async ()=>{
            const text =
                `Hookah Hub — Табак: «${tobacco.name}»\n`+
                `Бренд: ${tobacco.brand_name || '—'}\n`+
                `Теги: ${(tobacco.tags||[]).join(', ') || '—'}\n`;
            if (navigator.share){ try{ await navigator.share({ text }); }catch{} }
            else { await navigator.clipboard.writeText(text); alert('Скопировано'); }
        };

        // fav toggle
        root.querySelector('#favBtn').onclick = async ()=>{
            const user = getCurrentUser(); if (!user) return alert('Войдите, чтобы добавить в избранное');
            const rr = await fetch('/api/favorites-toggle', {
                method:'POST',
                headers:{ 'content-type':'application/json', 'x-tg-id': String(user.tg_id) },
                body: JSON.stringify({ item_type:'tobacco', item_id:id })
            });
            const jj = await rr.json(); if (jj?.ok){ favored = jj.favored; paintFav(); }
        };

        await checkFav();
    }

    load();
    return root;
}

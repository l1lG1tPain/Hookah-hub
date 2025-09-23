// src/pages/favorites/FavoritesPage.js
import { el } from '../../utils/dom.js';
import { getSession, authHeaders } from '../../app/state.js';

export function FavoritesPage(){
    const root = el('div', { class: 'page favorites' });
    root.innerHTML = `
    <header class="topbar">
      <h1>Избранное</h1>
    </header>

    <section class="content">
      <div class="tabs">
        <button class="tab active" data-tab="mixes">Миксы</button>
        <button class="tab" data-tab="tobaccos">Табаки</button>
      </div>

      <div id="list" class="fav-list"></div>
    </section>

    <footer class="navbar">
      <a href="#/">Главная</a>
      <a class="active" href="#/favorites">Избранное</a>
      <a href="#/profile">Профиль</a>
    </footer>
  `;

    const style = document.createElement('style');
    style.textContent = `
    .tabs{ display:flex; gap:8px; margin-bottom:12px; }
    .tab{ padding:8px 12px; border-radius:999px; border:1px solid var(--border); background:transparent; }
    .tab.active{ background:var(--bg-elevated); font-weight:600; }

    .fav-list{ display:flex; flex-direction:column; gap:10px; }

    .fav-item{
      position:relative; display:grid; grid-template-columns: 1fr auto;
      gap:10px; padding:12px; border:1px solid var(--border); border-radius:14px;
      background:var(--bg-elevated); text-decoration:none; color:inherit;
    }
    .fav-title{ font-weight:700; margin-bottom:4px; }
    .fav-desc{ opacity:.85; font-size:14px; line-height:1.35; }
    .fav-meta{ display:flex; gap:6px; flex-wrap:wrap; margin-top:6px; }
    .tag{ font-size:12px; padding:4px 8px; border-radius:999px; background:var(--chip-bg, #f1f1f1); }
    .brand{ opacity:.75; font-size:13px; }

    .fav-right{ display:flex; align-items:center; gap:8px; }
    .open-btn{ border:1px solid var(--border); border-radius:10px; padding:6px 10px; background:transparent; }
    .heart{
      width:40px;height:40px;border-radius:999px;border:1px solid var(--border);
      background:rgba(255,255,255,.8); display:flex; align-items:center; justify-content:center;
      cursor:pointer;
    }
    .heart.active{ background:#ffdee4; border-color:#ff99ad; }
    .heart span{ font-size:18px; }

    .empty{
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:10px; padding:48px 12px; color:var(--text-muted, #777);
    }
    .empty .emoji{ font-size:48px; line-height:1; filter:drop-shadow(0 2px 8px rgba(0,0,0,.05)); }
    .empty .msg{ font-size:16px; text-align:center; }
  `;
    document.head.appendChild(style);

    const list = root.querySelector('#list');
    const tabs = root.querySelector('.tabs');
    let currentTab = 'mixes';

    tabs.onclick = (e)=>{
        const b = e.target.closest('.tab'); if (!b) return;
        tabs.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active', x===b));
        currentTab = b.dataset.tab;
        load();
    };

    function rowMix(x){
        const a = document.createElement('a');
        a.href = `#/mix?id=${encodeURIComponent(x.id)}`;
        a.className = 'fav-item';
        a.innerHTML = `
      <div>
        <div class="fav-title">${x.name}</div>
        ${x.description ? `<div class="fav-desc">${x.description}</div>` : ''}
        ${x.tags?.length ? `<div class="fav-meta">${x.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div>` : ''}
      </div>
      <div class="fav-right">
        <button class="heart active" data-type="mix" data-id="${x.id}" title="Убрать из избранного"><span>❤️</span></button>
      </div>
    `;
        return a;
    }

    function rowTobacco(x){
        const a = document.createElement('a');
        a.href = `#/tobacco?id=${encodeURIComponent(x.id)}`;
        a.className = 'fav-item';
        a.innerHTML = `
      <div>
        <div class="fav-title">${x.name}</div>
        <div class="brand">${x.brand_name || ''}</div>
        ${x.tags?.length ? `<div class="fav-meta">${x.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div>` : ''}
      </div>
      <div class="fav-right">
        <button class="heart active" data-type="tobacco" data-id="${x.id}" title="Убрать из избранного"><span>❤️</span></button>
      </div>
    `;
        return a;
    }

    async function load(){
        list.innerHTML = 'Загрузка…';
        const token = getSession();
        if (!token){
            list.innerHTML = `
        <div class="empty">
          <div class="emoji">🦈</div>
          <div class="msg">Войдите через Telegram, чтобы видеть избранное</div>
        </div>`;
            return;
        }

        try{
            const r = await fetch(`/api/favorites-list?tab=${currentTab}`, { headers: { ...authHeaders() } });
            const j = await r.json();
            const items = j?.items || [];
            list.innerHTML = '';
            if (!items.length){
                list.innerHTML = `
          <div class="empty">
            <div class="emoji">🦈</div>
            <div class="msg">Вы ещё не добавляли ${currentTab === 'mixes' ? 'миксы' : 'табаки'} в избранное</div>
          </div>`;
                return;
            }
            for (const it of items) list.appendChild(currentTab==='mixes' ? rowMix(it) : rowTobacco(it));
        }catch(e){
            list.innerHTML = `
        <div class="empty">
          <div class="emoji">🦈</div>
          <div class="msg">Ошибка загрузки избранного</div>
        </div>`;
        }
    }

    // делегируем клики по сердечкам
    list.addEventListener('click', async (e)=>{
        const btn = e.target.closest('.heart'); if (!btn) return;
        e.preventDefault(); e.stopPropagation();

        const token = getSession(); if (!token) return alert('Войдите через Telegram');
        const type = btn.dataset.type, id = btn.dataset.id;

        // мгновенно прячем из списка
        const row = btn.closest('.fav-item');
        row.style.opacity = '.5';

        try{
            const r = await fetch('/api/favorites-toggle', {
                method: 'POST',
                headers: { 'content-type':'application/json', ...authHeaders() },
                body: JSON.stringify({ item_type: type, item_id: id })
            });
            const j = await r.json();
            if (!j?.ok || j.favored){ row.style.opacity = '1'; return; } // остался избранным — не убираем
            row.remove(); // успешно удалили
            if (!list.children.length){
                list.innerHTML = `
          <div class="empty">
            <div class="emoji">🦈</div>
            <div class="msg">Вы ещё не добавляли ${currentTab === 'mixes' ? 'миксы' : 'табаки'} в избранное</div>
          </div>`;
            }
        }catch{
            row.style.opacity = '1';
            alert('Не удалось обновить избранное');
        }
    });

    load();
    return root;
}

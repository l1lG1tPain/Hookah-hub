// src/pages/profile/ProfilePage.js — ПОЛНАЯ ЗАМЕНА

const LS_SESSION = 'hhsession';          // строковый токен сессии
const LS_USER    = 'hh:user_safe';       // { id, short, name, avatar_url }
const AVATAR_FALLBACK = 'https://placehold.co/128x128?text=HH';

// -- Storage helpers ----------------------------------------------------------
function getSession(){ try { return localStorage.getItem(LS_SESSION) || ''; } catch { return ''; } }
function setSession(t){ try { t ? localStorage.setItem(LS_SESSION, t) : localStorage.removeItem(LS_SESSION); } catch {} }
function getSafeUser(){ try { return JSON.parse(localStorage.getItem(LS_USER) || 'null'); } catch { return null; } }
function setSafeUser(u){ try { u ? localStorage.setItem(LS_USER, JSON.stringify(u)) : localStorage.removeItem(LS_USER); } catch {} }

// -- API helpers (все запросы идут через x-session) --------------------------
async function apiGet(url){
    const s = getSession();
    const r = await fetch(url, { headers: s ? { 'x-session': s } : {} });
    if (!r.ok) throw new Error('net');
    return r.json();
}
async function apiPost(url, body){
    const s = getSession();
    const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type':'application/json', ...(s ? { 'x-session': s } : {}) },
        body: JSON.stringify(body || {})
    });
    if (!r.ok) throw new Error('net');
    return r.json();
}

export function ProfilePage(){
    const root = document.createElement('div');
    root.className = 'page profile';
    root.innerHTML = `
  <header class="topbar"><h1>Профиль</h1></header>
  <section class="content">
    <!-- Вход -->
    <div id="authBlock">
      <div class="card">
        <div class="card__title">Войти через Telegram</div>
        <div class="muted">Мы откроем официальное приложение Telegram. После подтверждения входа вернитесь сюда — я всё подхвачу автоматически.</div>
        <div style="margin-top:12px;">
          <button id="tgDeep" class="btn primary">Открыть Telegram</button>
          <div id="status" class="muted" style="margin-top:8px;"></div>
        </div>
      </div>
    </div>

    <!-- Пользователь -->
    <div id="userBlock" style="display:none;">
      <div class="card usercard">
        <img id="avatar" class="avatar" src="${AVATAR_FALLBACK}" alt="">
        <div class="user-meta">
          <div class="name-row">
            <div id="uname" class="uname">—</div>
            <div id="uid" class="uid">#------</div>
          </div>
          <div class="muted small">Публичный ID нужен для отзывов и избранного.</div>
          <div class="actions">
            <button id="editNameBtn" class="btn">Изменить имя</button>
            <button id="logoutBtn" class="btn danger">Выйти</button>
          </div>
        </div>
      </div>

      <div class="grid navcards">
        <a class="navcard" href="#/favorites">
          <div class="nav-ico">❤️</div><div class="nav-title">Избранное</div>
          <div class="nav-sub muted">Миксы и табаки, отмеченные сердцем</div>
        </a>
        <a class="navcard" href="#/themes">
          <div class="nav-ico">🎨</div><div class="nav-title">Темы</div>
          <div class="nav-sub muted">Светлая / тёмная / авто</div>
        </a>
        <a class="navcard" href="#/settings">
          <div class="nav-ico">⚙️</div><div class="nav-title">Настройки</div>
          <div class="nav-sub muted">Профиль и предпочтения</div>
        </a>
        <a class="navcard" href="#/about">
          <div class="nav-ico">ℹ️</div><div class="nav-title">О приложении</div>
          <div class="nav-sub muted">Версия и контакты</div>
        </a>
      </div>
    </div>
  </section>
  <footer class="navbar">
    <a href="#/">Главная</a>
    <a href="#/favorites">Избранное</a>
    <a class="active" href="#/profile">Профиль</a>
  </footer>
  `;

    // Стили локально
    const style = document.createElement('style');
    style.textContent = `
    .card{ border:1px solid var(--border); border-radius:14px; padding:12px; background:var(--bg-elevated); }
    .card__title{ font-weight:700; margin-bottom:6px; }
    .btn{ border:1px solid var(--border); border-radius:10px; padding:8px 12px; background:transparent; }
    .btn.primary{ background:var(--bg-elevated-2, #f4f4f4); font-weight:600; }
    .btn.danger{ border-color:#ff9aa9; color:#c52340; }
    .muted{ opacity:.75; } .small{ font-size:.9em; }

    .usercard{ display:flex; gap:12px; align-items:center; }
    .avatar{ width:64px; height:64px; border-radius:50%; object-fit:cover; background:#ddd; }
    .user-meta{ flex:1; min-width:0; }
    .name-row{ display:flex; gap:10px; align-items:baseline; }
    .uname{ font-weight:700; font-size:18px; }
    .uid{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; opacity:.8; }
    .actions{ display:flex; gap:8px; margin-top:10px; flex-wrap:wrap; }

    .grid.navcards{ display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:12px; margin-top:12px; }
    @media (min-width: 920px){ .grid.navcards{ grid-template-columns: repeat(4, minmax(0,1fr)); } }
    .navcard{ display:block; text-decoration:none; color:inherit; border:1px solid var(--border);
              border-radius:12px; padding:12px; background:var(--bg-elevated); }
    .nav-ico{ font-size:22px; }
    .nav-title{ font-weight:700; margin-top:4px; }
    .nav-sub{ font-size:.92em; }
  `;
    document.head.appendChild(style);

    // refs
    const authBlock = root.querySelector('#authBlock');
    const userBlock = root.querySelector('#userBlock');
    const statusEl  = root.querySelector('#status');
    const avatarEl  = root.querySelector('#avatar');
    const unameEl   = root.querySelector('#uname');
    const uidEl     = root.querySelector('#uid');

    // UI helpers
    function showAuth(){ authBlock.style.display = '';   userBlock.style.display = 'none'; }
    function showUser(){ authBlock.style.display = 'none'; userBlock.style.display = '';    }

    function paintUser(u){
        if (!u){ showAuth(); return; }
        avatarEl.src = u.avatar_url || AVATAR_FALLBACK;
        unameEl.textContent = u.name || '—';
        uidEl.textContent   = u.short ? `#${u.short}` : '—';
        showUser();
    }

    // whoami -> сохраняем "safe" в LS
    async function refreshUser(){
        try{
            const j = await apiGet('/api/whoami'); // { ok, user: { id, short, name, avatar_url } }
            if (j?.ok && j.user){
                setSafeUser(j.user);
                paintUser(j.user);
            } else {
                setSession(''); setSafeUser(null); showAuth();
            }
        }catch{
            setSession(''); setSafeUser(null); showAuth();
        }
    }

    // Старт Telegram-логина
    root.querySelector('#tgDeep').onclick = async () => {
        statusEl.textContent = 'Готовим ссылку…';
        try{
            const start = await apiPost('/api/auth-start', {}); // { ok, state, url | httpsLink/tgLink }
            if (!start?.ok) { statusEl.textContent = 'Не удалось начать авторизацию'; return; }

            const href = start.tgLink || start.httpsLink || start.url;
            if (href) window.open(href, '_blank');
            statusEl.textContent = 'Ожидаем подтверждение в Telegram…';

            const t0 = Date.now();
            const poll = async () => {
                try{
                    const w = await apiGet(`/api/auth-wait?state=${encodeURIComponent(start.state)}`); // { ok, status, session }
                    if (w?.ok && w.status === 'ok' && w.session){
                        setSession(w.session);           // сохранили ТОЛЬКО токен
                        await refreshUser();             // забрали safe-профиль
                        statusEl.textContent = '';
                        return;
                    }
                }catch{}
                if (Date.now() - t0 > 120000){ statusEl.textContent = 'Время ожидания истекло'; return; }
                setTimeout(poll, 1500);
            };
            poll();
        }catch{
            statusEl.textContent = 'Ошибка сети';
        }
    };

    // Смена имени (через x-session)
    root.querySelector('#editNameBtn').onclick = async () => {
        const safe = getSafeUser(); if (!getSession() || !safe) return alert('Сначала войдите');
        const next = prompt('Новое имя:', safe.name || '')?.trim();
        if (!next || next.length < 2) return;
        try{
            const j = await apiPost('/api/profile-name-change', { name: next });
            if (j?.ok){ await refreshUser(); alert('Имя обновлено'); }
            else alert(j?.error || 'Не удалось изменить имя');
        }catch{ alert('Ошибка сети'); }
    };

    // Выход — чистим и ПОЛНОСТЬЮ перезагружаем
    root.querySelector('#logoutBtn').onclick = () => {
        setSession(''); setSafeUser(null);
        location.reload();
    };

    // Инициализация UI
    const s = getSession();
    const cached = getSafeUser();
    if (s && cached) paintUser(cached); else showAuth();
    if (s) refreshUser();

    return root;
}

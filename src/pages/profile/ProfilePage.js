// /src/pages/profile/ProfilePage.js (полная замена)
export function ProfilePage(){
    const div = document.createElement('div');
    div.className = 'page profile';
    div.innerHTML = `
    <header class="topbar"><h1>Профиль</h1></header>
    <section class="content">
      <div id="authBlock">
        <p>Авторизация через Telegram:</p>
        <p><button id="tgDeep" class="btn">Открыть в Telegram</button></p>
        <div id="status"></div>
      </div>
      <div id="userBlock" style="display:none">
        <div style="display:flex; align-items:center; gap:12px;">
          <img id="avatar" style="width:64px; height:64px; border-radius:50%; object-fit:cover; display:none">
          <div>
            <div id="uname" style="font-weight:600;"></div>
            <div class="muted">tg_id: <span id="utgid"></span></div>
          </div>
        </div>
        <div style="margin-top:12px; display:flex; gap:8px;">
          <button id="editNameBtn">Редактировать имя (1 раз)</button>
          <button id="logoutBtn" class="danger">Выйти</button>
        </div>
      </div>
      <pre id="whoami" style="overflow:auto; margin-top:12px;"></pre>
    </section>
    <footer class="navbar">
      <a href="#/">Главная</a>
      <a href="#/favorites">Избранное</a>
      <a href="#/profile" class="active">Профиль</a>
    </footer>
  `;

    async function startDeepLogin(){
        const status = div.querySelector('#status');
        status.textContent = 'Готовим ссылку…';
        const r = await fetch('/api/auth-start', { method:'POST' });
        const j = await r.json().catch(()=>({}));
        if (!j.ok) { status.textContent = 'Ошибка старта: ' + (j.error || ''); return; }
        // Открываем Telegram
        const href = /Android|iPhone/i.test(navigator.userAgent) ? j.tgLink : j.httpsLink;
        window.open(href, '_blank');
        status.textContent = 'Ожидаем подтверждение в Telegram…';
        const t0 = Date.now();
        const timer = setInterval(async () => {
            const rr = await fetch(`/api/auth-wait?state=${j.state}`);
            const ans = await rr.json().catch(()=>({}));
            if (ans.ok && ans.user) {
                clearInterval(timer);
                localStorage.setItem('hh:user', JSON.stringify(ans.user));
                renderUser(ans.user);
            } else if (Date.now() - t0 > 120000) {
                clearInterval(timer);
                status.textContent = 'Время ожидания истекло. Попробуйте ещё раз.';
            }
        }, 1500);
    }

    function renderUser(u){
        const who = div.querySelector('#whoami');
        who.textContent = JSON.stringify(u, null, 2);
        div.querySelector('#authBlock').style.display = 'none';
        div.querySelector('#userBlock').style.display = '';
        const ava = div.querySelector('#avatar');
        if (u.avatar_url) { ava.src = u.avatar_url; ava.style.display='block'; }
        div.querySelector('#uname').textContent = u.name || '';
        div.querySelector('#utgid').textContent = u.tg_id || '';
    }

    div.querySelector('#tgDeep').addEventListener('click', startDeepLogin);

    // выход
    div.querySelector('#logoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem('hh:user');
        location.replace('#/profile');
    });

    // одноразовая смена имени
    div.querySelector('#editNameBtn')?.addEventListener('click', async () => {
        const u = JSON.parse(localStorage.getItem('hh:user')||'null');
        if (!u) return alert('Войдите сначала');
        const name = prompt('Новое имя:');
        if (!name || name.trim().length < 2) return;
        const r = await fetch('/api/profile-name-change', {
            method: 'POST',
            headers: { 'content-type':'application/json', 'x-tg-id': String(u.tg_id) },
            body: JSON.stringify({ name })
        });
        const d = await r.json().catch(()=>({}));
        if (d.ok && d.user) {
            localStorage.setItem('hh:user', JSON.stringify(d.user));
            renderUser(d.user);
            alert('Имя изменено');
        } else {
            alert(d.error || 'Ошибка');
        }
    });

    // показать, если уже залогинен
    try {
        const u = JSON.parse(localStorage.getItem('hh:user')||'null');
        if (u) renderUser(u);
    } catch {}

    return div;
}

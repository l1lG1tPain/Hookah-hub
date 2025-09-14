export function ProfilePage(){
    const div = document.createElement('div');
    div.className = 'page profile';
    div.innerHTML = `
    <header class="topbar"><h1>Профиль</h1></header>
    <section class="content">
      <p>Авторизация через Telegram:</p>
      <p><button id="tgDeep" class="btn">Открыть в Telegram</button></p>
      <div id="status"></div>
      <pre id="whoami" style="overflow:auto;"></pre>
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

        // Открываем приложение Telegram
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
                status.textContent = 'Готово!';
                const who = div.querySelector('#whoami');
                who.textContent = JSON.stringify(ans.user, null, 2);
            } else if (Date.now() - t0 > 120000) {
                clearInterval(timer);
                status.textContent = 'Время ожидания истекло. Попробуйте ещё раз.';
            }
        }, 1500);
    }

    div.querySelector('#tgDeep').addEventListener('click', startDeepLogin);

    // Показать, если уже залогинен
    try {
        const u = JSON.parse(localStorage.getItem('hh:user')||'null');
        if (u) div.querySelector('#whoami').textContent = JSON.stringify(u, null, 2);
    } catch {}

    return div;
}

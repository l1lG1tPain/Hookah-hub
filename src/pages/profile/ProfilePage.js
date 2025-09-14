export function ProfilePage(){
    const div = document.createElement('div');
    div.className = 'page profile';
    div.innerHTML = `
    <header class="topbar"><h1>Профиль</h1></header>
    <section class="content">
      <p>Авторизация через Telegram:</p>
      <div id="tgLogin"></div>
      <pre id="whoami" style="overflow:auto;"></pre>
    </section>
    <footer class="navbar">
      <a href="#/">Главная</a>
      <a href="#/favorites">Избранное</a>
      <a href="#/profile" class="active">Профиль</a>
    </footer>
  `;

    // вставим Telegram Login Widget
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', 'hookah_akulka_bot'); // << замени на @без @
    script.setAttribute('data-size', 'large');
    // виджет сделает GET на наш эндпоинт с initData
    script.setAttribute('data-auth-url', '/api/auth/telegram');
    script.setAttribute('data-request-access', 'write');
    div.querySelector('#tgLogin').append(script);

    // в конце render() после вставки виджета:
    const who = div.querySelector('#whoami');
    try { const u = JSON.parse(localStorage.getItem('hh:user')||'null'); if (u) who.textContent = JSON.stringify(u, null, 2); } catch {}


    // перехватим ответ (виджет редиректит страницу; удобнее дёрнуть вручную кнопкой — следующий шаг)
    // На MVP можно дополнительно добавить форму input для initData и POSTом его слать.

    return div;
}

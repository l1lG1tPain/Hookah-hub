export function FavoritesPage(){
    const div = document.createElement('div');
    div.className = 'page favorites';
    div.innerHTML = `
    <header class="topbar"><h1>Избранное</h1></header>
    <section class="content">
      <p>Здесь будет список избранных миксов/табаков.</p>
    </section>
    <footer class="navbar">
      <a href="#/">Главная</a>
      <a href="#/favorites" class="active">Избранное</a>
      <a href="#/profile">Профиль</a>
    </footer>
  `;
    return div;
}

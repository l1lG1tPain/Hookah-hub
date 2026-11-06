const KEY = 'hh-theme'; // 'auto' | 'dark' | 'light'

export function getTheme() {
    try { return localStorage.getItem(KEY) || 'dark'; } catch { return 'dark'; }
}

export function applyTheme(t = getTheme()) {
    const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#16110e' : '#f5efe7');
}

export function setTheme(t) {
    try { localStorage.setItem(KEY, t); } catch {}
    applyTheme(t);
}

matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme());

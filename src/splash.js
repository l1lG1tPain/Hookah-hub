import { LOADING } from './lib/phrases.js';

const MIN_MS = 1600;
let t0 = 0, timer = null;

export function startSplash() {
    const el = document.getElementById('spPhrase');
    if (!el) return;
    t0 = Date.now();
    const pool = [...LOADING].sort(() => Math.random() - .5);
    let i = 0;
    const next = () => {
        el.classList.add('fade');
        setTimeout(() => { el.textContent = pool[i++ % pool.length]; el.classList.remove('fade'); }, 220);
    };
    next();
    timer = setInterval(next, 1300);
}

export function hideSplash() {
    const sp = document.getElementById('splash');
    if (!sp) return;
    const left = Math.max(0, MIN_MS - (Date.now() - t0));
    setTimeout(() => {
        clearInterval(timer);
        sp.classList.add('out');
        setTimeout(() => sp.remove(), 500);
    }, left);
}

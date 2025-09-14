// src/app/state.js (создай)
export function getCurrentUser(){
    try { return JSON.parse(localStorage.getItem('hh:user')||'null'); } catch { return null; }
}

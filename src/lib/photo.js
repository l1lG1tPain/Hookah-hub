/* Выбор фото: сжимаем на устройстве (WebP/JPEG, до 1024 px, до 200 КБ), только потом грузим в Supabase */
import { html, icon, toast } from './ui.js';

const MAX_SIDE = 1024, MAX_BYTES = 200 * 1024, MAX_INPUT = 15 * 1024 * 1024;

async function decode(file) {
    if (window.createImageBitmap) { try { return await createImageBitmap(file); } catch { /* HEIC и т.п. — пробуем <img> */ } }
    return new Promise((res, rej) => {
        const url = URL.createObjectURL(file), img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); res(img); };
        img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Не удалось открыть изображение')); };
        img.src = url;
    });
}
const toBlob = (c, type, q) => new Promise((r) => c.toBlob(r, type, q));

export async function compressImage(file) {
    if (!file?.type?.startsWith('image/')) throw new Error('Выберите изображение');
    if (file.size > MAX_INPUT) throw new Error('Файл больше 15 МБ');
    const img = await decode(file);
    let side = MAX_SIDE, q = 0.86;
    for (let i = 0; i < 9; i++) {
        const k = Math.min(1, side / Math.max(img.width, img.height));
        const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        let blob = await toBlob(c, 'image/webp', q);
        if (!blob || blob.type !== 'image/webp') blob = await toBlob(c, 'image/jpeg', q); // Safari без WebP-кодека
        if (blob && blob.size <= MAX_BYTES) return { blob, type: blob.type, ext: blob.type === 'image/webp' ? 'webp' : 'jpg', width: c.width, height: c.height };
        q -= 0.1;
        if (q < 0.45) { side *= 0.8; q = 0.8; }
    }
    throw new Error('Не удалось сжать фото до нужного размера');
}

export const photoField = (label = 'Добавить фото') => html`<div class="photo" data-photo>
    <label class="photo__pick">
      <span class="photo__ph">${icon('plus')}<b>${label}</b><small>до 200 КБ после сжатия</small></span>
      <img class="photo__img" alt="" hidden draggable="false">
      <input type="file" accept="image/*" hidden>
    </label>
    <button type="button" class="photo__x" hidden aria-label="Убрать фото">${icon('x')}</button>
  </div>`;

/** Подключает поле к корню; возвращает { get() → {blob,…}|null } */
export function bindPhoto(root) {
    const box = root.querySelector('[data-photo]');
    const input = box.querySelector('input'), img = box.querySelector('.photo__img'), ph = box.querySelector('.photo__ph'), x = box.querySelector('.photo__x');
    let result = null, url = null;
    const clear = () => { result = null; if (url) URL.revokeObjectURL(url); url = null; img.hidden = true; ph.hidden = false; x.hidden = true; input.value = ''; };
    input.addEventListener('change', async () => {
        const file = input.files?.[0]; if (!file) return;
        try {
            ph.querySelector('small').textContent = 'Сжимаем…';
            result = await compressImage(file);
            if (url) URL.revokeObjectURL(url);
            url = URL.createObjectURL(result.blob);
            img.src = url; img.hidden = false; ph.hidden = true; x.hidden = false;
        } catch (e) { toast(e.message || 'Не удалось обработать фото', 'err'); clear(); }
        finally { ph.querySelector('small').textContent = 'до 200 КБ после сжатия'; }
    });
    x.addEventListener('click', (e) => { e.preventDefault(); clear(); });
    return { get: () => result, clear };
}

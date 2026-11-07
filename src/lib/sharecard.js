/* Картинка-карточка для шаринга (canvas → PNG) */
import { fmtScore } from './ui.js';
import { hasRating } from './rating.js';
import { drawQr } from './qr.js';

const W = 1080, H = 1440;
const css = (n, d) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || d;

function loadImg(src) {
    return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.crossOrigin = 'anonymous'; i.src = src; });
}
function wrap(ctx, text, x, y, maxW, lh, maxLines) {
    const words = String(text).split(' '); let line = ''; const lines = [];
    for (const w of words) {
        const t = line ? line + ' ' + w : w;
        if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    lines.push(line);
    lines.slice(0, maxLines).forEach((l, i) => ctx.fillText(i === maxLines - 1 && lines.length > maxLines ? l.replace(/.?$/, '…') : l, x, y + i * lh));
    return Math.min(lines.length, maxLines);
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

async function paintBackdrop(ctx) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2a1710'); bg.addColorStop(1, '#120d0a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W * .85, H * .08, 0, W * .85, H * .08, 700);
    glow.addColorStop(0, 'rgba(255,122,61,.38)'); glow.addColorStop(1, 'rgba(255,122,61,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

    const shark = await loadImg('/icons/shark.webp');
    if (shark) {
        // у картинки жёсткий нижний край — плавно растворяем его
        const o = Object.assign(document.createElement('canvas'), { width: 230, height: 230 }), oc = o.getContext('2d');
        oc.drawImage(shark, 0, 0, 230, 230);
        const g = oc.createLinearGradient(0, 0, 0, 230); g.addColorStop(0.72, '#000'); g.addColorStop(1, 'transparent');
        oc.globalCompositeOperation = 'destination-in'; oc.fillStyle = g; oc.fillRect(0, 0, 230, 230);
        ctx.drawImage(o, W - 300, 50);
    }
}

const PNG = (c) => new Promise((r) => c.toBlob(r, 'image/png'));

/* Подвал: QR (если есть url) + «Hookah Hub» */
async function paintFooter(ctx, url, accent) {
    const qrSize = 210, qy = H - 70 - qrSize;
    let tx = 80;
    if (url) {
        drawQr(ctx, 80, qy, qrSize, url, await loadImg('/icons/192.png'));
        tx = 80 + qrSize + 36;
    }
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff6ee'; ctx.font = '800 48px "Unbounded Variable", sans-serif';
    ctx.fillText('Hookah', tx, qy + 78);
    ctx.fillStyle = accent; ctx.fillText('Hub', tx + ctx.measureText('Hookah ').width, qy + 78);
    ctx.fillStyle = '#b9a595'; ctx.font = '600 30px "Manrope Variable", sans-serif';
    ctx.fillText(url ? 'Наведите камеру, чтобы открыть' : 'hookahhub.netlify.app', tx, qy + 128);
    ctx.fillText('hookahhub.netlify.app', tx, qy + 172);
}

/* Карточка личной страницы: аватар, имя, @ник, статистика и крупный QR */
export async function makeProfileCard(a, url, stats = '') {
    await document.fonts?.ready;
    const c = Object.assign(document.createElement('canvas'), { width: W, height: H });
    const ctx = c.getContext('2d');
    const accent = css('--accent', '#ff7a3d'), accent2 = css('--accent-2', '#ffb547');
    await paintBackdrop(ctx);
    ctx.textBaseline = 'alphabetic';

    const R = 90, cx = 80 + R, cy = 130 + R;
    const img = a.avatar_url ? await loadImg(a.avatar_url) : null;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    if (img) ctx.drawImage(img, cx - R, cy - R, R * 2, R * 2);
    else {
        const g = ctx.createLinearGradient(0, cy - R, 0, cy + R); g.addColorStop(0, accent2); g.addColorStop(1, accent);
        ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
        ctx.fillStyle = '#1d0f06'; ctx.font = '800 96px "Unbounded Variable", sans-serif'; ctx.textAlign = 'center';
        ctx.fillText((a.name || '?').trim().slice(0, 1).toUpperCase(), cx, cy + 34); ctx.textAlign = 'left';
    }
    ctx.restore();
    ctx.strokeStyle = accent; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, R + 6, 0, Math.PI * 2); ctx.stroke();

    ctx.fillStyle = accent2; ctx.font = '700 34px "Manrope Variable", sans-serif';
    ctx.fillText('АВТОР МИКСОВ', 80, 400);
    ctx.fillStyle = '#fff6ee'; ctx.font = '800 76px "Unbounded Variable", sans-serif';
    const n = wrap(ctx, a.name, 80, 490, W - 160, 90, 2);
    let y = 490 + n * 90 - 20;
    if (a.handle) { ctx.fillStyle = accent; ctx.font = '700 46px "Manrope Variable", sans-serif'; ctx.fillText('@' + a.handle, 80, y + 50); y += 60; }
    if (stats) { ctx.fillStyle = '#b9a595'; ctx.font = '600 38px "Manrope Variable", sans-serif'; ctx.fillText(stats, 80, y + 50); }

    const qs = 520, qx = (W - qs) / 2, qy = 760;
    drawQr(ctx, qx, qy, qs, url, await loadImg('/icons/192.png'));
    ctx.textAlign = 'center'; ctx.fillStyle = '#d8c7b8'; ctx.font = '600 34px "Manrope Variable", sans-serif';
    ctx.fillText('Отсканируйте — все миксы автора', W / 2, qy + qs + 60);
    ctx.fillStyle = '#fff6ee'; ctx.font = '800 44px "Unbounded Variable", sans-serif';
    const w1 = ctx.measureText('Hookah ').width, w2 = ctx.measureText('Hub').width, bx = (W - w1 - w2) / 2;
    ctx.textAlign = 'left'; ctx.fillText('Hookah', bx, H - 70);
    ctx.fillStyle = accent; ctx.fillText('Hub', bx + w1, H - 70);
    return PNG(c);
}

export async function makeShareCard(x, type, url) {
    await document.fonts?.ready;
    const c = Object.assign(document.createElement('canvas'), { width: W, height: H });
    const ctx = c.getContext('2d');
    const accent = css('--accent', '#ff7a3d'), accent2 = css('--accent-2', '#ffb547');

    await paintBackdrop(ctx);

    ctx.textBaseline = 'alphabetic'; ctx.fillStyle = accent2;
    ctx.font = '700 34px "Manrope Variable", sans-serif';
    ctx.fillText((type === 'mix' ? 'МИКС' : 'ТАБАК') + (x.brand_name ? ' · ' + x.brand_name.toUpperCase() : ''), 80, 150);

    ctx.fillStyle = '#fff6ee'; ctx.font = '800 80px "Unbounded Variable", sans-serif';
    const n = wrap(ctx, x.name, 80, 270, W - 160, 96, 2);

    let y = 270 + n * 96 + 20;
    if (hasRating(x)) {
        ctx.fillStyle = accent; ctx.font = '800 120px "Unbounded Variable", sans-serif';
        ctx.fillText(fmtScore(x.avg_score), 80, y + 110);
        const w = ctx.measureText(fmtScore(x.avg_score)).width;
        ctx.fillStyle = '#b9a595'; ctx.font = '600 40px "Manrope Variable", sans-serif';
        ctx.fillText('/ 5 · ' + x.votes + ' оц.', 80 + w + 24, y + 108);
        y += 170;
    }

    if (x.ingredients?.length) {
        const cols = [1, 2, 3, 4, 5, 6].map((i) => css('--c' + i, ['#ff7a3d', '#ffb547', '#e4577a', '#8b6cf0', '#3fb58a', '#4aa3df'][i - 1]));
        // полоска состава
        let px = 80; const bw = W - 160;
        x.ingredients.forEach((ing, i) => {
            const w = bw * (ing.percent / 100);
            ctx.fillStyle = cols[i % 6]; rr(ctx, px, y, Math.max(w - 6, 6), 22, 11); ctx.fill(); px += w;
        });
        y += 80;
        x.ingredients.slice(0, 6).forEach((ing, i) => {
            ctx.fillStyle = cols[i % 6]; ctx.beginPath(); ctx.arc(94, y - 12, 12, 0, 7); ctx.fill();
            ctx.fillStyle = '#fff6ee'; ctx.font = '700 40px "Manrope Variable", sans-serif';
            const label = (ing.brand ? ing.brand + ' ' : '') + (ing.tobacco || ing.custom_title || '');
            let t = label; while (ctx.measureText(t).width > 640 && t.length > 4) t = t.slice(0, -2);
            ctx.fillText(t === label ? t : t + '…', 126, y);
            ctx.fillStyle = '#b9a595'; ctx.textAlign = 'right'; ctx.fillText(ing.percent + '%', W - 80, y); ctx.textAlign = 'left';
            y += 66;
        });
    } else if (x.description) {
        ctx.fillStyle = '#d8c7b8'; ctx.font = '500 44px "Manrope Variable", sans-serif';
        wrap(ctx, x.description, 80, y + 30, W - 160, 62, 6);
    }

    // QR на страницу микса/табака + подпись
    await paintFooter(ctx, url, accent);

    return PNG(c);
}

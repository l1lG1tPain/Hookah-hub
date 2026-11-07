/* Стильный QR «Ember Lounge»: круглые точки, глаза-рамки цвета углей, логотип в центре (canvas).
   Контраст сохранён: тёмные модули на светлой подложке, коррекция ошибок H под логотип. */
import qrcode from 'qrcode-generator';

const INK = '#1b120d', PAPER = '#fff6ee', EYE_A = '#e8561a', EYE_B = '#a83208';

function loadImg(src) {
    return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}

/** Рисует QR в квадрат size×size с левого верхнего угла (x, y). logo — готовая картинка или null. */
export function drawQr(ctx, x, y, size, url, logo = null) {
    const qr = qrcode(0, 'H'); qr.addData(url); qr.make();
    const n = qr.getModuleCount(), quiet = 2, cell = size / (n + quiet * 2);
    const ox = x + quiet * cell, oy = y + quiet * cell;

    ctx.fillStyle = PAPER; ctx.beginPath(); ctx.roundRect(x, y, size, size, size * 0.07); ctx.fill();

    const inEye = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
    const L = logo ? (Math.round(n * 0.2) | 1) : 0, s0 = Math.floor((n - L) / 2);
    const inLogo = (r, c) => L && r >= s0 && r < s0 + L && c >= s0 && c < s0 + L;

    ctx.fillStyle = INK;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        if (!qr.isDark(r, c) || inEye(r, c) || inLogo(r, c)) continue;
        ctx.beginPath(); ctx.arc(ox + (c + 0.5) * cell, oy + (r + 0.5) * cell, cell * 0.44, 0, Math.PI * 2); ctx.fill();
    }

    for (const [r0, c0] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
        const ex = ox + c0 * cell, ey = oy + r0 * cell;
        const g = ctx.createLinearGradient(ex, ey, ex + 7 * cell, ey + 7 * cell);
        g.addColorStop(0, EYE_A); g.addColorStop(1, EYE_B);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(ex, ey, 7 * cell, 7 * cell, cell * 2.2);
        ctx.roundRect(ex + cell, ey + cell, 5 * cell, 5 * cell, cell * 1.3);
        ctx.fill('evenodd');
        ctx.beginPath(); ctx.roundRect(ex + 2 * cell, ey + 2 * cell, 3 * cell, 3 * cell, cell * 1.1); ctx.fill();
    }

    if (logo && L) {
        const lx = ox + s0 * cell, ly = oy + s0 * cell, ls = L * cell;
        ctx.save();
        ctx.beginPath(); ctx.roundRect(lx, ly, ls, ls, ls * 0.26); ctx.clip();
        ctx.fillStyle = PAPER; ctx.fillRect(lx, ly, ls, ls);
        const pad = ls * 0.1;
        ctx.drawImage(logo, lx + pad, ly + pad, ls - pad * 2, ls - pad * 2);
        ctx.restore();
    }
}

/** Готовый canvas с QR (для показа в шторке и сохранения). px — сторона в пикселях. */
export async function makeQrCanvas(url, px = 720) {
    const c = Object.assign(document.createElement('canvas'), { width: px, height: px });
    drawQr(c.getContext('2d'), 0, 0, px, url, await loadImg('/icons/192.png'));
    return c;
}
